import assert from "node:assert/strict";
import crypto from "crypto";
import http from "http";
import express from "express";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";
import WhatsAppWebhookHandler from "../modules/whatsapp/WhatsAppWebhookHandler.js";
import WhatsAppProviderFactory from "../modules/whatsapp/providers/WhatsAppProviderFactory.js";
import MetaProviderAdapter from "../modules/whatsapp/providers/MetaProviderAdapter.js";
import WhatsAppAllowlistPolicy, { AUTHORIZED_E164_PHONE } from "../modules/whatsapp/policies/WhatsAppAllowlistPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppSessionService from "../modules/whatsapp/WhatsAppSessionService.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";
import AIService from "../../services/AIService.js";

async function runMetaMigrationTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING META CLOUD API COMPREHENSIVE SUITE");
  console.log("=================================================\n");

  const testVerifyToken = "test_meta_verify_token_xyz987";
  const testAppSecret = "test_meta_app_secret_1234567890abcdef";
  const testAccessToken = "test_meta_access_token_super_secret";
  const testPhoneNumberId = "735218809665742";
  const testWabaId = "2175260026311711";
  const testSender = "8310412768";

  process.env.WHATSAPP_PROVIDER = "meta";
  process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
  process.env.WHATSAPP_APP_SECRET = testAppSecret;
  process.env.WHATSAPP_ACCESS_TOKEN = testAccessToken;
  process.env.WHATSAPP_PHONE_NUMBER_ID = testPhoneNumberId;
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = testWabaId;
  process.env.WHATSAPP_GRAPH_API_VERSION = "v23.0";
  process.env.WHATSAPP_TEST_SENDER = testSender;

  // -------------------------------------------------------------
  // Test 1: Meta provider selection & No accidental Whapi selection
  // -------------------------------------------------------------
  console.log("Test 1: Provider selection respects priority and defaults to Meta");
  const defaultProvider = WhatsAppProviderFactory.getProvider();
  assert.ok(defaultProvider instanceof MetaProviderAdapter, "Default provider must be MetaProviderAdapter");
  assert.equal(defaultProvider.name, "meta");

  // Even with WHAPI_TOKEN present, WHATSAPP_PROVIDER=meta must resolve to Meta
  process.env.WHAPI_TOKEN = "leftover_whapi_token_value_999";
  const metaWithWhapiToken = WhatsAppProviderFactory.getProvider();
  assert.ok(metaWithWhapiToken instanceof MetaProviderAdapter, "Must resolve to Meta even if WHAPI_TOKEN is set");
  assert.equal(metaWithWhapiToken.name, "meta");

  // Any non-meta provider must throw an error
  assert.throws(() => {
    WhatsAppProviderFactory.getProvider("whapi");
  }, /Only "meta" is supported/);
  console.log("✅ Test 1 passed: Provider selection priority and Meta exclusivity verified\n");

  // -------------------------------------------------------------
  // Test 2 & 3 & 4 & 5: Express Webhook GET verification & HMAC Auth
  // -------------------------------------------------------------
  console.log("Test 2-5: Webhook verification and HMAC-SHA256 authentication with rawBody");
  const metaAdapter = new MetaProviderAdapter({
    appSecret: testAppSecret,
    verifyToken: testVerifyToken,
    phoneNumberId: testPhoneNumberId,
    accessToken: testAccessToken,
  });

  // GET Verification challenge
  const validGetReq = {
    query: {
      "hub.mode": "subscribe",
      "hub.verify_token": testVerifyToken,
      "hub.challenge": "CHALLENGE_META_12345",
    },
  };
  const getResult = metaAdapter.verifyWebhook(validGetReq);
  assert.equal(getResult.verified, true);
  assert.equal(getResult.status, 200);
  assert.equal(getResult.challenge, "CHALLENGE_META_12345");

  // GET Invalid verify token -> fails closed
  const invalidGetReq = {
    query: {
      "hub.mode": "subscribe",
      "hub.verify_token": "WRONG_TOKEN",
      "hub.challenge": "CHALLENGE_META_12345",
    },
  };
  const invalidGetResult = metaAdapter.verifyWebhook(invalidGetReq);
  assert.equal(invalidGetResult.verified, false);
  assert.equal(invalidGetResult.status, 403);

  // POST Signature verification with raw body
  const samplePayloadStr = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: testWabaId,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "971501234567",
                phone_number_id: testPhoneNumberId,
              },
              contacts: [{ profile: { name: "Test User" }, wa_id: "918310412768" }],
              messages: [
                {
                  from: "918310412768",
                  id: "wamid.inbound_001",
                  timestamp: "1789538000",
                  text: { body: "Hello Meta" },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const rawBuf = Buffer.from(samplePayloadStr, "utf8");
  const validHmac = crypto.createHmac("sha256", testAppSecret).update(rawBuf).digest("hex");

  // Valid signature
  const validPostReq = {
    rawBody: rawBuf,
    body: JSON.parse(samplePayloadStr),
    headers: { "x-hub-signature-256": `sha256=${validHmac}` },
  };
  const validAuth = metaAdapter.authenticateWebhook(validPostReq);
  assert.equal(validAuth.authenticated, true);
  assert.equal(validAuth.status, 200);

  // Invalid signature
  const invalidPostReq = {
    rawBody: rawBuf,
    body: JSON.parse(samplePayloadStr),
    headers: { "x-hub-signature-256": "sha256=invalid_signature_hex_0000000000000000000000000000000000000000000000000000000000000000" },
  };
  const invalidAuth = metaAdapter.authenticateWebhook(invalidPostReq);
  assert.equal(invalidAuth.authenticated, false);
  assert.equal(invalidAuth.status, 403);

  // Missing signature
  const missingPostReq = {
    rawBody: rawBuf,
    body: JSON.parse(samplePayloadStr),
    headers: {},
  };
  const missingAuth = metaAdapter.authenticateWebhook(missingPostReq);
  assert.equal(missingAuth.authenticated, false);
  assert.equal(missingAuth.status, 403);
  console.log("✅ Tests 2-5 passed: Verification and HMAC authentication strictly validated\n");

  // -------------------------------------------------------------
  // Tests 6, 7, 8, 9: Inbound Event Normalization
  // -------------------------------------------------------------
  console.log("Test 6-9: Meta Inbound Normalization (Text, Button, List, Flow)");
  
  // 6. Text Normalization
  const textEvents = metaAdapter.normalizeInbound(JSON.parse(samplePayloadStr));
  assert.equal(textEvents.length, 1);
  assert.equal(textEvents[0].provider, "meta");
  assert.equal(textEvents[0].eventType, "MESSAGE");
  assert.equal(textEvents[0].messageType, "text");
  assert.equal(textEvents[0].text, "Hello Meta");
  assert.equal(textEvents[0].customerWaId, "918310412768");
  assert.equal(textEvents[0].phoneNumberId, testPhoneNumberId);
  assert.equal(textEvents[0].messageId, "wamid.inbound_001");

  // 7. Interactive Button Normalization
  const encodedButtonAction = WhatsappActionCodec.encode({ id: "SELECT_PRODUCT", payload: { productId: "self-ink-stamps" } });
  const buttonPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: testPhoneNumberId },
              messages: [
                {
                  from: "918310412768",
                  id: "wamid.button_001",
                  timestamp: "1789538010",
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: {
                      id: encodedButtonAction,
                      title: "Self Ink Stamps",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const buttonEvents = metaAdapter.normalizeInbound(buttonPayload);
  assert.equal(buttonEvents.length, 1);
  assert.equal(buttonEvents[0].eventType, "ACTION");
  assert.equal(buttonEvents[0].action?.id, "SELECT_PRODUCT");
  assert.equal(buttonEvents[0].action?.payload?.productId, "self-ink-stamps");

  // 8. Interactive List Normalization
  const encodedListAction = WhatsappActionCodec.encode({ id: "SELECT_SELECTION", payload: { productId: "self-ink-stamps", selectionId: "round" } });
  const listPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: testPhoneNumberId },
              messages: [
                {
                  from: "918310412768",
                  id: "wamid.list_001",
                  timestamp: "1789538020",
                  type: "interactive",
                  interactive: {
                    type: "list_reply",
                    list_reply: {
                      id: encodedListAction,
                      title: "Round Stamp",
                      description: "Official seals",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const listEvents = metaAdapter.normalizeInbound(listPayload);
  assert.equal(listEvents.length, 1);
  assert.equal(listEvents[0].eventType, "ACTION");
  assert.equal(listEvents[0].action?.id, "SELECT_SELECTION");
  assert.equal(listEvents[0].action?.payload?.selectionId, "round");

  // 9. Flow Submission Normalization
  const flowPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: testPhoneNumberId },
              messages: [
                {
                  from: "918310412768",
                  id: "wamid.flow_001",
                  timestamp: "1789538030",
                  type: "interactive",
                  interactive: {
                    type: "nfm_reply",
                    nfm_reply: {
                      name: "ORDER_FORM",
                      body: "test_flow_token_123",
                      response_json: JSON.stringify({
                        screen: "ORDER_FORM",
                        quantity: 2,
                        inkColor: "Blue",
                      }),
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const flowEvents = metaAdapter.normalizeInbound(flowPayload);
  assert.equal(flowEvents.length, 1);
  assert.equal(flowEvents[0].eventType, "FLOW_SUBMISSION");
  assert.equal(flowEvents[0].isFlowSubmission, true);
  assert.equal(flowEvents[0].flow?.responseJson?.quantity, 2);
  assert.equal(flowEvents[0].flow?.flowToken, "test_flow_token_123");
  console.log("✅ Tests 6-9 passed: Inbound event normalization verified\n");

  // -------------------------------------------------------------
  // Tests 10, 11, 12: Meta Outbound Message Formatting
  // -------------------------------------------------------------
  console.log("Test 10-12: Meta Outbound Formatting & Graph API Endpoints");
  let capturedFetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    capturedFetchCalls.push({ url, opts, body: JSON.parse(opts.body || "{}") });
    return {
      ok: true,
      status: 200,
      json: async () => ({ messaging_product: "whatsapp", messages: [{ id: `wamid.out_${Date.now()}` }] }),
      arrayBuffer: async () => Buffer.from("dummy_media_bytes"),
    };
  };

  try {
    // 10. Outbound Text
    await metaAdapter.sendMessage("918310412768", {
      type: "text",
      text: { body: "Hello customer" },
    });
    assert.equal(capturedFetchCalls.length, 1);
    assert.equal(capturedFetchCalls[0].url, `https://graph.facebook.com/v23.0/${testPhoneNumberId}/messages`);
    assert.equal(capturedFetchCalls[0].opts.headers.Authorization, `Bearer ${testAccessToken}`);
    assert.equal(capturedFetchCalls[0].body.messaging_product, "whatsapp");
    assert.equal(capturedFetchCalls[0].body.to, "918310412768");
    assert.equal(capturedFetchCalls[0].body.type, "text");
    assert.equal(capturedFetchCalls[0].body.text.body, "Hello customer");

    // 11. Outbound Interactive Buttons
    await metaAdapter.sendMessage("918310412768", {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Choose action" },
        action: { buttons: [{ type: "reply", reply: { id: "btn_1", title: "Option 1" } }] },
      },
    });
    assert.equal(capturedFetchCalls.length, 2);
    assert.equal(capturedFetchCalls[1].body.type, "interactive");
    assert.equal(capturedFetchCalls[1].body.interactive.type, "button");

    // 12. Outbound WhatsApp Flow
    await metaAdapter.sendFlow("918310412768", {
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: "Complete order" },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: "tok_123",
            flow_id: "order_flow_123",
            flow_cta: "Open Order Form",
            flow_action: "navigate",
            flow_action_payload: { screen: "ORDER_FORM" },
          },
        },
      },
    });
    assert.equal(capturedFetchCalls.length, 3);
    assert.equal(capturedFetchCalls[2].body.interactive.type, "flow");
    assert.equal(capturedFetchCalls[2].body.interactive.action.parameters.flow_id, "order_flow_123");
    console.log("✅ Tests 10-12 passed: Meta outbound message dispatch verified\n");
  } finally {
    globalThis.fetch = originalFetch;
  }

  // -------------------------------------------------------------
  // Tests 13 & 14: Allowlist Policy
  // -------------------------------------------------------------
  console.log("Test 13-14: Allowlist Policy Enforcement");
  const allowlistPolicy = new WhatsAppAllowlistPolicy();
  assert.equal(allowlistPolicy.isAuthorized("8310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("+918310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("918310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("08310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("8310412768@c.us"), true);

  // Unauthorized numbers
  assert.equal(allowlistPolicy.isAuthorized("9876543210"), false);
  assert.equal(allowlistPolicy.isAuthorized("+919876543210"), false);
  assert.equal(allowlistPolicy.isAuthorized("+18310412768"), false); // US number with same suffix
  assert.equal(allowlistPolicy.isAuthorized(""), false);
  assert.equal(allowlistPolicy.isAuthorized(null), false);
  console.log("✅ Tests 13-14 passed: Strict allowlist enforcement verified\n");

  // -------------------------------------------------------------
  // Test 15: Deduplication
  // -------------------------------------------------------------
  console.log("Test 15: Deduplication");
  const service = new WhatsAppService();
  assert.equal(service.isDuplicateMessage("wamid.unique_001"), false);
  service.markMessageProcessed("wamid.unique_001");
  assert.equal(service.isDuplicateMessage("wamid.unique_001"), true);
  console.log("✅ Test 15 passed: Duplicate message detection verified\n");

  // -------------------------------------------------------------
  // Test 16: Session Isolation
  // -------------------------------------------------------------
  console.log("Test 16: Session Isolation");
  const sessionService = new WhatsAppSessionService();
  const session1 = sessionService.buildSessionId("8310412768", testPhoneNumberId);
  const session2 = sessionService.buildSessionId("9876543210", testPhoneNumberId);
  assert.equal(session1, `whatsapp:${testPhoneNumberId}:918310412768`);
  assert.notEqual(session1, session2);
  console.log("✅ Test 16 passed: Session isolation verified\n");

  // -------------------------------------------------------------
  // Test 17: 24-Hour Customer Service Window Policy
  // -------------------------------------------------------------
  console.log("Test 17: 24-Hour Customer Service Window");
  const outboundPolicy = new WhatsAppOutboundPolicy({
    windowPolicy: new WhatsAppCustomerServiceWindowPolicy(),
  });
  const now = Date.now();

  // Fresh message within 24h
  const freshAuth = outboundPolicy.authorizeOutbound({
    to: "918310412768",
    message: { type: "text", text: { body: "Hello" } },
    inboundTriggerContext: {
      triggeredByInboundMessage: true,
      inboundMessageId: "wamid.in_123",
      customerWaId: "918310412768",
      authenticated: true,
      inboundReceivedAt: now - 3600000, // 1 hour ago
      provider: "meta",
    },
    now,
  });
  assert.equal(freshAuth.allowed, true);
  assert.equal(freshAuth.blocked, false);

  // Expired message (> 24h)
  const expiredAuth = outboundPolicy.authorizeOutbound({
    to: "918310412768",
    message: { type: "text", text: { body: "Hello" } },
    inboundTriggerContext: {
      triggeredByInboundMessage: true,
      inboundMessageId: "wamid.in_old",
      customerWaId: "918310412768",
      authenticated: true,
      inboundReceivedAt: now - (25 * 3600000), // 25 hours ago
      provider: "meta",
    },
    now,
  });
  assert.equal(expiredAuth.allowed, false);
  assert.equal(expiredAuth.blocked, true);
  assert.equal(expiredAuth.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  console.log("✅ Test 17 passed: 24-Hour customer service window enforced\n");

  // -------------------------------------------------------------
  // Test 18: Direct processMessage provider selection
  // -------------------------------------------------------------
  console.log("Test 18: Direct processMessage provider selection");
  const directService = new WhatsAppService();
  let capturedNormalizedEvent = null;
  directService.processNormalizedEvent = async (event) => {
    capturedNormalizedEvent = event;
    return { ok: true };
  };

  await directService.processMessage({
    message: {
      id: "wamid.direct_001",
      from: "918310412768",
      type: "text",
      text: { body: "Direct test" },
      timestamp: "1789538100",
    },
    metadata: { phone_number_id: testPhoneNumberId },
  });

  assert.ok(capturedNormalizedEvent);
  assert.equal(capturedNormalizedEvent.provider, "meta");
  assert.equal(capturedNormalizedEvent.phoneNumberId, testPhoneNumberId);
  assert.equal(capturedNormalizedEvent.customerWaId, "918310412768");
  console.log("✅ Test 18 passed: processMessage correctly resolves provider=meta\n");

  // -------------------------------------------------------------
  // Test 19: Full End-to-End Express Webhook Flow with Meta Provider
  // -------------------------------------------------------------
  console.log("Test 19: Full End-to-End Express Webhook Route with Meta Provider");
  const e2eApiService = new WhatsAppApiService({
    accessToken: testAccessToken,
    phoneNumberId: testPhoneNumberId,
  });
  let e2eOutboundCalls = [];
  e2eApiService.sendMessage = async (to, message, options) => {
    e2eOutboundCalls.push({ to, message, options });
    return { messaging_product: "whatsapp", messages: [{ id: `wamid.out_${Date.now()}` }] };
  };

  AIService.prototype.loadConversation = async function ({ sessionId }) {
    return {
      sessionId,
      customer: {},
      messages: [],
      status: "ACTIVE",
      workflow: "NONE",
    };
  };

  const e2eService = new WhatsAppService(e2eApiService);
  const e2eWebhookHandler = new WhatsAppWebhookHandler(e2eService);

  const e2eApp = express();
  e2eApp.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  e2eApp.get("/webhooks/whatsapp", (req, res) => e2eWebhookHandler.verify(req, res));
  e2eApp.post("/webhooks/whatsapp", (req, res) => e2eWebhookHandler.handle(req, res));

  const e2eServer = http.createServer(e2eApp);
  await new Promise((resolve) => e2eServer.listen(0, resolve));
  const e2ePort = e2eServer.address().port;
  const e2eUrl = `http://127.0.0.1:${e2ePort}/webhooks/whatsapp`;

  try {
    const e2ePayloadStr = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: testWabaId,
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: testPhoneNumberId },
                contacts: [{ profile: { name: "Nawaz" }, wa_id: "918310412768" }],
                messages: [
                  {
                    from: "918310412768",
                    id: "wamid.e2e_meta_001",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: "I need self ink stamps" },
                    type: "text",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const e2eRawBuf = Buffer.from(e2ePayloadStr, "utf8");
    const e2eHmac = crypto.createHmac("sha256", testAppSecret).update(e2eRawBuf).digest("hex");

    const e2ePostRes = await fetch(e2eUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": `sha256=${e2eHmac}`,
      },
      body: e2ePayloadStr,
    });

    assert.equal(e2ePostRes.status, 200);
    const ack = await e2ePostRes.text();
    assert.equal(ack, "EVENT_RECEIVED");

    // Wait for background processing
    await new Promise((r) => setTimeout(r, 600));

    assert.ok(e2eOutboundCalls.length > 0, "Outbound message must be dispatched for allowlisted customer");
    assert.equal(e2eOutboundCalls[0].to, "918310412768");
    console.log("✅ Test 19 passed: End-to-end Meta webhook processing completed successfully\n");
  } finally {
    e2eServer.close();
  }

  console.log("=================================================");
  console.log("🎉 ALL 19 META CLOUD API MIGRATION TESTS PASSED!");
  console.log("=================================================");
}

runMetaMigrationTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
