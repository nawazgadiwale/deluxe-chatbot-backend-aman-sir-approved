import assert from "node:assert/strict";
import crypto from "crypto";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppRealtimeService from "../modules/whatsapp/services/WhatsAppRealtimeService.js";
import WhatsAppCustomerServiceWindowPolicy, {
  WINDOW_DURATION_MS,
} from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";

async function runAllowlistTests() {
  console.log("=================================================");
  console.log("🔒 TESTING REAL META API SINGLE-SENDER ALLOWLIST");
  console.log("=================================================\n");

  // Configure environment for allowlist testing: ONLY 8310412768 is allowed
  process.env.WHATSAPP_TEST_SENDER = "8310412768";
  process.env.WHATSAPP_VERIFY_TOKEN = "verify_token_123";
  process.env.WHATSAPP_APP_SECRET = "app_secret_456";
  process.env.WHATSAPP_ACCESS_TOKEN = "mock_access_token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_id_1001";

  let metaApiCalls = [];
  const mockApiService = {
    accessToken: "mock_access_token",
    phoneNumberId: "phone_id_1001",
    sendMessage: async (to, message) => {
      metaApiCalls.push({ to, message, timestamp: Date.now() });
      return {
        messaging_product: "whatsapp",
        contacts: [{ input: to, wa_id: to }],
        messages: [{ id: `wamid.out_${Date.now()}` }],
      };
    },
  };

  const memoryStore = new Map();
  const mockConversationRepo = {
    findBySessionId: async (sessionId) => memoryStore.get(sessionId) || null,
    findByCustomerWaId: async (customerWaId) => {
      for (const conv of memoryStore.values()) {
        if (conv.customerWaId === customerWaId) return conv;
      }
      return null;
    },
    createConversation: async (data) => {
      const conv = { ...data, messages: [] };
      memoryStore.set(data.sessionId, conv);
      return conv;
    },
    updateConversation: async (sessionId, update) => {
      const conv = memoryStore.get(sessionId) || { sessionId, messages: [] };
      Object.assign(conv, update);
      memoryStore.set(sessionId, conv);
      return conv;
    },
    addMessage: async (sessionId, msg) => {
      const conv = memoryStore.get(sessionId) || { sessionId, messages: [] };
      conv.messages.push(msg);
      memoryStore.set(sessionId, conv);
      return conv;
    },
    updateMessageStatus: async (wamid, status) => {
      for (const conv of memoryStore.values()) {
        const m = conv.messages.find((msg) => msg.whatsappMessageId === wamid);
        if (m) {
          m.status = status;
          return conv;
        }
      }
      return null;
    },
  };

  const realtimeService = new WhatsAppRealtimeService();
  const windowPolicy = new WhatsAppCustomerServiceWindowPolicy();
  const outboundPolicy = new WhatsAppOutboundPolicy({ windowPolicy });

  let aiCalls = [];
  const mockAiService = {
    chat: async (params) => {
      aiCalls.push(params);
      return {
        messages: [{ role: "assistant", content: "Hello! How can ExprintMart assist you?" }],
      };
    },
  };

  const service = new WhatsAppService(
    mockApiService,
    windowPolicy,
    outboundPolicy,
    null,
    mockConversationRepo,
    realtimeService,
    mockAiService
  );

  const baseTime = Date.now();

  // ============================================================
  // Test A: Authorized sender (8310412768) is processed normally
  // ============================================================
  console.log("Test A: Authorized sender (8310412768) is processed");
  metaApiCalls = [];
  aiCalls = [];

  const authPayload = {
    message: {
      from: "8310412768",
      id: "wamid.auth_001",
      timestamp: String(Math.floor(baseTime / 1000)),
      type: "text",
      text: { body: "Hi I need visiting cards" },
    },
    metadata: {
      phone_number_id: "phone_id_1001",
      display_phone_number: "15550001",
    },
    contacts: [{ profile: { name: "Authorized User" }, wa_id: "8310412768" }],
  };

  await service.processMessage(authPayload);

  assert.equal(aiCalls.length, 1);
  assert.equal(aiCalls[0].channel, "WHATSAPP");
  assert.equal(metaApiCalls.length, 1);
  assert.equal(metaApiCalls[0].to, "8310412768");
  console.log("✅ Test A passed: Authorized sender (8310412768) received AI response\n");

  // ============================================================
  // Test B: Unauthorized sender is completely ignored
  // ============================================================
  console.log("Test B: Unauthorized sender is completely ignored");
  metaApiCalls = [];
  aiCalls = [];

  const unauthPayload = {
    message: {
      from: "919876543210", // Unauthorized number
      id: "wamid.unauth_001",
      timestamp: String(Math.floor(baseTime / 1000)),
      type: "text",
      text: { body: "Hello from unauthorized sender" },
    },
    metadata: {
      phone_number_id: "phone_id_1001",
      display_phone_number: "15550001",
    },
    contacts: [{ profile: { name: "Random Person" }, wa_id: "919876543210" }],
  };

  await service.processMessage(unauthPayload);

  assert.equal(aiCalls.length, 0); // AI was NEVER invoked
  assert.equal(metaApiCalls.length, 0); // ZERO Meta API calls
  console.log("✅ Test B passed: Unauthorized sender produced ZERO AI and ZERO Meta API calls\n");

  // ============================================================
  // Test C: Unauthorized sender cannot establish or reset customer service window
  // ============================================================
  console.log("Test C: Unauthorized sender cannot establish or reset window");
  const unauthWindow = windowPolicy.getLastUserMessageAt("919876543210");
  assert.equal(unauthWindow, null);
  console.log("✅ Test C passed: Unauthorized sender did NOT open/modify customer-service window\n");

  // ============================================================
  // Test D: Authorized sender after 24h sends new message -> fresh window opened
  // ============================================================
  console.log("Test D: Authorized sender sends new message after expiry -> fresh 24h window");
  metaApiCalls = [];
  aiCalls = [];

  const timeAfter30h = baseTime + 30 * 60 * 60 * 1000;
  const authPayloadAfterExpiry = {
    message: {
      from: "918310412768", // Authorized with country code 91
      id: "wamid.auth_002_fresh",
      timestamp: String(Math.floor(timeAfter30h / 1000)),
      type: "text",
      text: { body: "I want to place an order now" },
    },
    metadata: {
      phone_number_id: "phone_id_1001",
      display_phone_number: "15550001",
    },
    contacts: [{ profile: { name: "Authorized User" }, wa_id: "918310412768" }],
  };

  await service.processMessage(authPayloadAfterExpiry);

  assert.equal(aiCalls.length, 1);
  assert.equal(metaApiCalls.length, 1);
  assert.equal(metaApiCalls[0].to, "918310412768");
  console.log("✅ Test D passed: Authorized sender after expiry opened fresh window and received reply\n");

  // ============================================================
  // Test E: Authorized sender with expired window and NO new message -> Outbound BLOCKED
  // ============================================================
  console.log("Test E: Authorized sender with expired window and NO new message -> Outbound BLOCKED");
  metaApiCalls = [];

  const timeExpired = timeAfter30h + WINDOW_DURATION_MS + 5000; // Expired
  const blockedSend = await service.sendMessage(
    "8310412768",
    { type: "text", text: { body: "Unsolicited follow-up" } },
    {
      now: timeExpired,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.auth_002_fresh",
        customerWaId: "8310412768",
        phoneNumberId: "phone_id_1001",
        inboundReceivedAt: timeAfter30h,
      },
    }
  );

  assert.equal(blockedSend.sent, false);
  assert.equal(blockedSend.blocked, true);
  assert.equal(blockedSend.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(metaApiCalls.length, 0); // ZERO Meta calls
  console.log("✅ Test E passed: Expired window strictly blocked outbound with ZERO Meta calls\n");

  // ============================================================
  // Test F: Recipient Isolation (Cannot redirect outbound away from authenticated customer)
  // ============================================================
  console.log("Test F: Recipient Isolation (Redirect attempt blocked)");
  metaApiCalls = [];

  const spoofedSend = await service.sendMessage(
    "919999999999", // Attempting to send to different number
    { type: "text", text: { body: "Redirected message" } },
    {
      now: timeAfter30h + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.auth_002_fresh",
        customerWaId: "8310412768", // Inbound was from 8310412768
        inboundReceivedAt: timeAfter30h,
      },
    }
  );

  assert.equal(spoofedSend.sent, false);
  assert.equal(spoofedSend.blocked, true);
  assert.equal(spoofedSend.reason, "OUTBOUND_RECIPIENT_MISMATCH");
  assert.equal(metaApiCalls.length, 0); // ZERO Meta calls
  console.log("✅ Test F passed: Recipient mismatch strictly blocked with ZERO Meta calls\n");

  // Clean up env variable after test
  delete process.env.WHATSAPP_TEST_SENDER;

  console.log("=================================================");
  console.log("🎉 ALL REAL META API ALLOWLIST TESTS (A-F) PASSED!");
  console.log("=================================================");
}

runAllowlistTests().catch((err) => {
  console.error("❌ Allowlist test failed:", err);
  process.exit(1);
});
