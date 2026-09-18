import assert from "node:assert/strict";
import crypto from "crypto";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppRealtimeService from "../modules/whatsapp/services/WhatsAppRealtimeService.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import WhatsAppAllowlistPolicy from "../modules/whatsapp/policies/WhatsAppAllowlistPolicy.js";
import WhatsAppFlowSubmissionService from "../modules/whatsapp/flows/WhatsAppFlowSubmissionService.js";

async function runStrictSingleSenderTests() {
  console.log("=================================================");
  console.log("🔒 META WHATSAPP SINGLE-SENDER ONLY TEST SUITE");
  console.log("=================================================\n");

  // Single authorized sender configuration
  process.env.WHATSAPP_PROVIDER = "meta";
  process.env.WHATSAPP_TEST_SENDER = "8310412768";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "735218809665742";
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "2175260026311711";
  process.env.WHATSAPP_ACCESS_TOKEN = "test_meta_token";
  process.env.WHATSAPP_APP_SECRET = "test_app_secret";
  process.env.WHATSAPP_VERIFY_TOKEN = "test_verify_token";

  const allowlistPolicy = new WhatsAppAllowlistPolicy();

  // Verify normalization of authorized sender
  assert.equal(allowlistPolicy.getAuthorizedE164(), "+918310412768");
  assert.equal(allowlistPolicy.isAuthorized("8310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("+918310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("918310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("08310412768"), true);
  assert.equal(allowlistPolicy.isAuthorized("8310412768@c.us"), true);
  console.log("✅ 1. Canonical normalization for authorized sender passed");

  // Verify non-authorized numbers fail strictly (no partial or suffix matching)
  const unauthorizedNumbers = [
    "+919999999999",
    "+918888888888",
    "+971500000000",
    "+141555555555",
    "+18310412768", // US number with same suffix
    "18310412768",
    "9998310412768",
    "invalid_phone",
    "",
    null,
    undefined,
  ];

  for (const num of unauthorizedNumbers) {
    assert.equal(
      allowlistPolicy.isAuthorized(num),
      false,
      `Number ${num} should NOT be authorized`,
    );
  }
  console.log("✅ 2. Strict non-match for all unauthorized numbers passed");

  // Track operations
  let aiCalls = [];
  let outboundMetaCalls = [];
  let orderCreatedCount = 0;
  let leadCreatedCount = 0;
  let sessionCreatedCount = 0;

  const mockAiService = {
    chat: async (params) => {
      aiCalls.push(params);
      return {
        messages: [{ role: "assistant", content: "AI response for authorized customer" }],
      };
    },
  };

  const mockApiService = {
    accessToken: "test_meta_token",
    phoneNumberId: "735218809665742",
    sendMessage: async (to, message) => {
      outboundMetaCalls.push({ to, message, timestamp: Date.now() });
      return {
        messaging_product: "whatsapp",
        contacts: [{ input: to, wa_id: to }],
        messages: [{ id: `wamid.out_${Date.now()}` }],
      };
    },
    sendFlow: async (to, message) => {
      outboundMetaCalls.push({ to, message, type: "flow", timestamp: Date.now() });
      return {
        messaging_product: "whatsapp",
        contacts: [{ input: to, wa_id: to }],
        messages: [{ id: `wamid.flow_out_${Date.now()}` }],
      };
    },
  };

  const conversationStore = new Map();
  const mockConversationRepo = {
    findBySessionId: async (sessionId) => conversationStore.get(sessionId) || null,
    findByCustomerWaId: async (customerWaId) => {
      for (const conv of conversationStore.values()) {
        if (conv.customerWaId === customerWaId) return conv;
      }
      return null;
    },
    createConversation: async (data) => {
      sessionCreatedCount++;
      const conv = { ...data, messages: [] };
      conversationStore.set(data.sessionId, conv);
      return conv;
    },
    updateConversation: async (sessionId, update) => {
      const conv = conversationStore.get(sessionId) || { sessionId, messages: [] };
      Object.assign(conv, update);
      conversationStore.set(sessionId, conv);
      return conv;
    },
    addMessage: async (sessionId, msg) => {
      const conv = conversationStore.get(sessionId) || { sessionId, messages: [] };
      conv.messages.push(msg);
      conversationStore.set(sessionId, conv);
      return conv;
    },
  };

  const mockOrderRepo = {
    create: async () => {
      orderCreatedCount++;
      return { _id: "order_123" };
    },
  };

  const windowPolicy = new WhatsAppCustomerServiceWindowPolicy();
  const outboundPolicy = new WhatsAppOutboundPolicy({
    windowPolicy,
    allowlistPolicy,
  });
  const realtimeService = new WhatsAppRealtimeService();

  const service = new WhatsAppService(
    mockApiService,
    windowPolicy,
    outboundPolicy,
    null,
    mockConversationRepo,
    realtimeService,
    mockAiService,
    allowlistPolicy,
  );

  const baseTime = Date.now();

  // ============================================================
  // Test 3: Authorized sender (+918310412768) -> triggers AI & receives response
  // ============================================================
  console.log("\nTest 3: Authorized sender (+918310412768) triggers AI & receives outbound message");
  aiCalls = [];
  outboundMetaCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry_auth_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "735218809665742" },
              messages: [
                {
                  from: "+918310412768",
                  id: "wamid.auth_001",
                  timestamp: String(Math.floor(baseTime / 1000)),
                  type: "text",
                  text: { body: "Hi, I want business cards" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 1, "AI must be called for authorized sender");
  assert.equal(outboundMetaCalls.length, 1, "Outbound message must be sent to authorized sender");
  assert.equal(allowlistPolicy.isAuthorized(outboundMetaCalls[0].to), true);
  console.log("✅ 3. Authorized sender processed successfully");

  // ============================================================
  // Test 4: Multiple unauthorized senders -> ZERO AI, ZERO OUTBOUND, ZERO DB MUTATION
  // ============================================================
  console.log("\nTest 4: Multiple unauthorized senders (+919999999999, +918888888888, +971500000000, +141555555555)");

  const testUnauthorizedSenders = [
    "+919999999999",
    "+918888888888",
    "+971500000000",
    "+141555555555",
    "+18310412768",
  ];

  for (const sender of testUnauthorizedSenders) {
    aiCalls = [];
    outboundMetaCalls = [];
    const prevSessions = sessionCreatedCount;

    await service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: `entry_unauth_${sender}`,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "735218809665742" },
                messages: [
                  {
                    from: sender,
                    id: `wamid.unauth_${Date.now()}`,
                    timestamp: String(Math.floor(baseTime / 1000)),
                    type: "text",
                    text: { body: "Can I order 100 flyers?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(aiCalls.length, 0, `AI must NOT be called for unauthorized sender ${sender}`);
    assert.equal(outboundMetaCalls.length, 0, `No outbound messages for unauthorized sender ${sender}`);
    assert.equal(sessionCreatedCount, prevSessions, `No session created for ${sender}`);
  }
  console.log("✅ 4. All unauthorized senders produced ZERO AI, ZERO outbound, and ZERO sessions");

  // ============================================================
  // Test 5: Unauthorized sender testing ALL message types (text, button, list, flow, media, location, contacts)
  // ============================================================
  console.log("\nTest 5: Unauthorized sender attempting various message types");

  const messageTypes = [
    { type: "text", text: { body: "Order now" } },
    { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "ORDER_NOW", title: "Order" } } },
    { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "item_1", title: "Flyers" } } },
    { type: "interactive", interactive: { type: "nfm_reply", nfm_reply: { response_json: "{}", name: "flow" } } },
    { type: "image", image: { id: "media_img_1", mime_type: "image/jpeg" } },
    { type: "document", document: { id: "media_doc_1", filename: "artwork.pdf" } },
    { type: "location", location: { latitude: 25.2048, longitude: 55.2708 } },
    { type: "contacts", contacts: [{ name: { formatted_name: "John" } }] },
  ];

  for (const msgPayload of messageTypes) {
    aiCalls = [];
    outboundMetaCalls = [];

    await service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: `entry_type_${msgPayload.type}`,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "735218809665742" },
                messages: [
                  {
                    from: "+919999999999",
                    id: `wamid.type_${msgPayload.type}_${Date.now()}`,
                    timestamp: String(Math.floor(baseTime / 1000)),
                    ...msgPayload,
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(aiCalls.length, 0, `AI must NOT be called for unauthorized message type: ${msgPayload.type}`);
    assert.equal(outboundMetaCalls.length, 0, `No outbound messages for unauthorized message type: ${msgPayload.type}`);
  }
  console.log("✅ 5. All message types from unauthorized senders safely dropped");

  // ============================================================
  // Test 6: Direct processMessage() call with unauthorized sender
  // ============================================================
  console.log("\nTest 6: Direct processMessage() call with unauthorized sender");
  aiCalls = [];
  outboundMetaCalls = [];

  await service.processMessage({
    message: {
      from: "+971500000000",
      id: "wamid.direct_unauth",
      type: "text",
      text: { body: "Direct call attempt" },
    },
    metadata: { phone_number_id: "735218809665742" },
    contacts: [{ wa_id: "+971500000000" }],
  });

  assert.equal(aiCalls.length, 0, "Direct processMessage with unauthorized sender must NOT invoke AI");
  assert.equal(outboundMetaCalls.length, 0, "Direct processMessage with unauthorized sender must NOT send message");
  console.log("✅ 6. Direct processMessage() with unauthorized sender silently dropped");

  // ============================================================
  // Test 7: Direct WhatsAppFlowSubmissionService call with unauthorized customerWaId
  // ============================================================
  console.log("\nTest 7: Direct Flow Submission Service with unauthorized sender");
  const flowService = new WhatsAppFlowSubmissionService({
    conversationRepository: mockConversationRepo,
    orderRepository: mockOrderRepo,
    allowlistPolicy,
  });

  const flowResult = await flowService.handleFlowSubmission({
    flowData: { quantity: 500 },
    flowToken: "some_token",
    messageId: "wamid.flow_unauth",
    customerWaId: "+919999999999",
  });

  assert.equal(flowResult.handled, false);
  assert.equal(flowResult.error, "UNAUTHORIZED_SENDER");
  assert.equal(orderCreatedCount, 0, "Zero orders created by unauthorized flow submission");
  console.log("✅ 7. Direct Flow Submission from unauthorized sender rejected");

  // ============================================================
  // Test 8: Direct sendMessage() and OutboundPolicy block unauthorized recipient
  // ============================================================
  console.log("\nTest 8: Direct sendMessage() to unauthorized recipient");
  outboundMetaCalls = [];

  const blockedRes = await service.sendMessage(
    "+919999999999",
    { type: "text", text: { body: "Unauthorized message" } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.fake",
        customerWaId: "+919999999999",
      },
    },
  );

  assert.equal(blockedRes.sent, false);
  assert.equal(blockedRes.blocked, true);
  assert.equal(blockedRes.reason, "UNAUTHORIZED_RECIPIENT");
  assert.equal(outboundMetaCalls.length, 0, "No Meta API calls for unauthorized recipient");
  console.log("✅ 8. Outbound sending to unauthorized recipient strictly blocked");

  // ============================================================
  // Test 9: Authorized flow submission processes normally
  // ============================================================
  console.log("\nTest 9: Authorized user continues order workflow with buttons & replies");
  aiCalls = [];
  outboundMetaCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry_auth_button",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "735218809665742" },
              messages: [
                {
                  from: "8310412768",
                  id: "wamid.auth_button_002",
                  timestamp: String(Math.floor((baseTime + 2000) / 1000)),
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: "SELECT_PRODUCT", title: "Business Cards" },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 1, "Authorized button reply triggers AI");
  assert.equal(outboundMetaCalls.length, 1, "Authorized button reply generates outbound response");
  console.log("✅ 9. Authorized button reply processed normally");

  console.log("\n=================================================");
  console.log("🎉 ALL SINGLE-SENDER ISOLATION TESTS PASSED!");
  console.log("=================================================");
}

runStrictSingleSenderTests().catch((err) => {
  console.error("❌ Single sender test failed:", err);
  process.exit(1);
});
