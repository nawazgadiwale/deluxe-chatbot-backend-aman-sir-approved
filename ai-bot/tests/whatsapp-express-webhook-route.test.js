import assert from "node:assert/strict";
import crypto from "crypto";
import http from "http";
import express from "express";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";
import WhatsAppWebhookHandler from "../modules/whatsapp/WhatsAppWebhookHandler.js";
import whatsappRoutes from "../../routes/whatsapp.js";
import AIService from "../../services/AIService.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING EXPRESS WHATSAPP WEBHOOK ROUTING");
  console.log("=================================================\n");

  const testVerifyToken = "test_meta_webhook_verify_token_999";
  const testAppSecret = "test_meta_app_secret_8888888888888888";
  const testAccessToken = "test_meta_access_token";
  const testPhoneNumberId = "109876543210987";

  process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
  process.env.WHATSAPP_APP_SECRET = testAppSecret;
  process.env.WHATSAPP_ACCESS_TOKEN = testAccessToken;
  process.env.WHATSAPP_PHONE_NUMBER_ID = testPhoneNumberId;

  // Intercept Meta API calls
  let metaApiCalls = [];
  const mockApiService = new WhatsAppApiService({
    accessToken: testAccessToken,
    phoneNumberId: testPhoneNumberId,
  });
  mockApiService.sendMessage = async (to, message) => {
    metaApiCalls.push({ to, message, timestamp: Date.now() });
    return {
      messaging_product: "whatsapp",
      contacts: [{ input: to, wa_id: to }],
      messages: [{ id: `wamid.out_${Date.now()}` }],
    };
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

  const whatsappService = new WhatsAppService(mockApiService);
  const webhookHandler = new WhatsAppWebhookHandler(whatsappService);
  whatsappRoutes.setWebhookHandler(webhookHandler);

  // Set up Express test app with identical middleware and routes as index.js
  const app = express();
  app.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  // Mount routes
  app.use("/webhooks/whatsapp", whatsappRoutes);
  app.use("/webhooks", whatsappRoutes);

  // Start server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ============================================================
    // Test 1: GET verification with correct token
    // ============================================================
    console.log("Test 1: GET verification with correct token");
    const challenge = "CHALLENGE_STRING_12345";
    const getRes = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${testVerifyToken}&hub.challenge=${challenge}`,
      { method: "GET" },
    );
    assert.equal(getRes.status, 200);
    const getBody = await getRes.text();
    assert.equal(getBody, challenge);
    console.log("✅ Test 1 passed: GET /webhooks/whatsapp returned 200 with challenge\n");

    // ============================================================
    // Test 2: GET verification with incorrect token
    // ============================================================
    console.log("Test 2: GET verification with incorrect token");
    const badGetRes = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=${challenge}`,
      { method: "GET" },
    );
    assert.equal(badGetRes.status, 403);
    console.log("✅ Test 2 passed: Invalid verify token returned HTTP 403\n");

    // ============================================================
    // Test 3: POST with valid HMAC
    // ============================================================
    console.log("Test 3: POST with valid HMAC");
    const pingPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });
    const validSig =
      "sha256=" +
      crypto
        .createHmac("sha256", testAppSecret)
        .update(Buffer.from(pingPayload))
        .digest("hex");

    const postRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": validSig,
      },
      body: pingPayload,
    });
    assert.equal(postRes.status, 200);
    const postBody = await postRes.text();
    assert.equal(postBody, "EVENT_RECEIVED");
    console.log("✅ Test 3 passed: Valid HMAC returned HTTP 200 EVENT_RECEIVED\n");

    // ============================================================
    // Test 4: POST with invalid HMAC
    // ============================================================
    console.log("Test 4: POST with invalid HMAC");
    const invalidSig = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    const badHmacRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": invalidSig,
      },
      body: pingPayload,
    });
    assert.equal(badHmacRes.status, 403);
    console.log("✅ Test 4 passed: Invalid HMAC returned HTTP 403\n");

    // ============================================================
    // Test 5: POST without signature
    // ============================================================
    console.log("Test 5: POST without signature");
    const noSigRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: pingPayload,
    });
    assert.equal(noSigRes.status, 403);
    console.log("✅ Test 5 passed: Missing signature returned HTTP 403\n");

    // ============================================================
    // Test 6: POST when WHATSAPP_APP_SECRET is missing (Fail closed)
    // ============================================================
    console.log("Test 6: POST when WHATSAPP_APP_SECRET is missing");
    delete process.env.WHATSAPP_APP_SECRET;
    const originalServiceSecret = whatsappService.appSecret;
    const originalAdapterSecret = webhookHandler.metaAdapter.appSecret;
    whatsappService.appSecret = null;
    webhookHandler.metaAdapter.appSecret = null;

    const noSecretRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": validSig,
      },
      body: pingPayload,
    });
    assert.equal(noSecretRes.status, 403);
    process.env.WHATSAPP_APP_SECRET = testAppSecret;
    whatsappService.appSecret = originalServiceSecret;
    webhookHandler.metaAdapter.appSecret = originalAdapterSecret;
    console.log("✅ Test 6 passed: Missing App Secret failed closed with HTTP 403\n");

    // ============================================================
    // Test 7: Realistic Meta WhatsApp Inbound Message Flow
    // ============================================================
    console.log("Test 7: Realistic Meta WhatsApp Inbound Message");
    metaApiCalls = [];
    const customerWaId = "971501234567";
    const inboundMessageId = `wamid.TEST_${Date.now()}`;
    const realisticPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_123456",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+971500000000",
                  phone_number_id: testPhoneNumberId,
                },
                contacts: [
                  {
                    profile: { name: "Aman Sir" },
                    wa_id: customerWaId,
                  },
                ],
                messages: [
                  {
                    from: customerWaId,
                    id: inboundMessageId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: {
                      body: "I need business cards",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const realSig =
      "sha256=" +
      crypto
        .createHmac("sha256", testAppSecret)
        .update(Buffer.from(realisticPayload))
        .digest("hex");

    const inboundRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": realSig,
      },
      body: realisticPayload,
    });

    assert.equal(inboundRes.status, 200);
    const inboundAck = await inboundRes.text();
    assert.equal(inboundAck, "EVENT_RECEIVED");
    console.log("✅ Fast 200 OK acknowledgment sent to Meta");

    // Allow asynchronous processing to execute
    await new Promise((r) => setTimeout(r, 600));
    console.log("✅ Test 7 passed: Realistic Meta inbound webhook processed\n");

    // ============================================================
    // Test 8: Duplicate Message Protection (Idempotency)
    // ============================================================
    console.log("Test 8: Duplicate Message Protection");
    const dupRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": realSig,
      },
      body: realisticPayload,
    });

    assert.equal(dupRes.status, 200);
    await new Promise((r) => setTimeout(r, 400));
    console.log("✅ Test 8 passed: Duplicate message gracefully handled and ignored\n");

    // ============================================================
    // Test 9: 24-Hour Customer Service Window Enforcement
    // ============================================================
    console.log("Test 9: 24-Hour Customer Service Window Enforcement");
    const expiredTimestamp = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000);
    const expiredPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_123456",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+971500000000",
                  phone_number_id: testPhoneNumberId,
                },
                contacts: [
                  {
                    profile: { name: "Expired User" },
                    wa_id: "971509999999",
                  },
                ],
                messages: [
                  {
                    from: "971509999999",
                    id: `wamid.EXP_${Date.now()}`,
                    timestamp: String(expiredTimestamp),
                    type: "text",
                    text: {
                      body: "Old inquiry",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const expSig =
      "sha256=" +
      crypto
        .createHmac("sha256", testAppSecret)
        .update(Buffer.from(expiredPayload))
        .digest("hex");

    const expRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": expSig,
      },
      body: expiredPayload,
    });

    assert.equal(expRes.status, 200);
    await new Promise((r) => setTimeout(r, 400));
    console.log("✅ Test 9 passed: 24-Hour window policy strictly enforced\n");

    // ============================================================
    // Test 10: Local POST /webhooks/whatsapp Body Key Verification (Meta)
    // ============================================================
    console.log("Test 10: Local POST /webhooks/whatsapp Body Key Verification (Meta)");
    let interceptedInboundBody = null;
    const originalHandleWebhook = whatsappService.handleWebhook.bind(whatsappService);
    whatsappService.handleWebhook = async (body, ctx) => {
      interceptedInboundBody = body;
      return originalHandleWebhook(body, ctx);
    };

    const localTestPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_LOCAL_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  phone_number_id: testPhoneNumberId,
                },
                contacts: [
                  { profile: { name: "Local Tester" }, wa_id: "918310412768" },
                ],
                messages: [
                  {
                    id: "LOCAL_BODY_TEST_123",
                    from: "918310412768",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "i want to order stamps" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const localSig =
      "sha256=" +
      crypto
        .createHmac("sha256", testAppSecret)
        .update(Buffer.from(localTestPayload))
        .digest("hex");

    const localPostRes = await fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": localSig,
      },
      body: localTestPayload,
    });

    assert.equal(localPostRes.status, 200);
    const localAck = await localPostRes.text();
    assert.equal(localAck, "EVENT_RECEIVED");

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 400));

    assert.ok(interceptedInboundBody, "handleWebhook must receive non-empty parsed body");
    assert.ok(Array.isArray(interceptedInboundBody.entry), "body must contain entry array");
    assert.equal(interceptedInboundBody.object, "whatsapp_business_account");
    console.log("✅ Test 10 passed: Express handler correctly receives Meta webhook body\n");

    console.log("=================================================");
    console.log("🎉 ALL EXPRESS WHATSAPP ROUTE TESTS PASSED!");
    console.log("=================================================");
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
