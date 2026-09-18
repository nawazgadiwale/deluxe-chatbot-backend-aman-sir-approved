import assert from "node:assert/strict";
import crypto from "crypto";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";
import WhatsAppRealtimeService from "../modules/whatsapp/services/WhatsAppRealtimeService.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import WhatsAppAllowlistPolicy from "../modules/whatsapp/policies/WhatsAppAllowlistPolicy.js";
import AIService from "../../services/AIService.js";
import AIController from "../../controllers/aiController.js";
import sendWhatsAppMessage from "../../services/whatsappService.js";

async function runInboundOnlySingleSenderSuite() {
  console.log("=================================================");
  console.log("🧪 STRICT META WHATSAPP — INBOUND ONLY & SINGLE SENDER");
  console.log("=================================================\n");

  // Configure environment strictly according to Section 5
  process.env.WHATSAPP_PROVIDER = "meta";
  process.env.WHATSAPP_BOT_NUMBER = "+97142725202";
  process.env.WHATSAPP_TEST_SENDER = "8310412768";
  process.env.WHATSAPP_ACCESS_TOKEN = "test_meta_access_token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_id_for_97142725202";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v23.0";
  process.env.WHATSAPP_APP_SECRET = "test_app_secret";
  process.env.WHATSAPP_VERIFY_TOKEN = "test_verify_token";

  const allowlistPolicy = new WhatsAppAllowlistPolicy();
  assert.equal(allowlistPolicy.getAuthorizedE164(), "+918310412768");

  let metaApiCalls = [];
  const mockApiService = {
    accessToken: "test_meta_access_token",
    phoneNumberId: "phone_id_for_97142725202",
    sendMessage: async (to, message) => {
      metaApiCalls.push({
        to,
        message,
        fromPhoneNumberId: "phone_id_for_97142725202",
        botNumber: "+97142725202",
        timestamp: Date.now(),
      });
      return {
        messaging_product: "whatsapp",
        contacts: [{ input: to, wa_id: to }],
        messages: [{ id: `wamid.out_${Date.now()}` }],
      };
    },
    sendFlow: async (to, message) => {
      metaApiCalls.push({
        to,
        message,
        type: "flow",
        fromPhoneNumberId: "phone_id_for_97142725202",
        botNumber: "+97142725202",
        timestamp: Date.now(),
      });
      return {
        messaging_product: "whatsapp",
        contacts: [{ input: to, wa_id: to }],
        messages: [{ id: `wamid.flow_out_${Date.now()}` }],
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
  };

  let aiCalls = [];
  const mockAiService = {
    chat: async (params) => {
      aiCalls.push(params);
      return {
        messages: [{ role: "assistant", content: "Hello! How can Deluxe Printing assist you?" }],
      };
    },
  };

  const windowPolicy = new WhatsAppCustomerServiceWindowPolicy();
  const outboundPolicy = new WhatsAppOutboundPolicy({
    windowPolicy,
    allowlistPolicy,
  });
  const realtimeService = new WhatsAppRealtimeService();

  // ============================================================
  // STEP 1: Start backend -> No WhatsApp message sent
  // ============================================================
  console.log("STEP 1: Backend Startup & Initialization");
  metaApiCalls = [];
  aiCalls = [];

  const service = new WhatsAppService(
    mockApiService,
    windowPolicy,
    outboundPolicy,
    null,
    mockConversationRepo,
    realtimeService,
    mockAiService,
    null,
    allowlistPolicy,
  );

  assert.equal(metaApiCalls.length, 0, "Startup must produce 0 Meta API calls");
  assert.equal(aiCalls.length, 0, "Startup must produce 0 AI calls");
  console.log("✅ STEP 1 PASSED: 0 WhatsApp messages sent on startup\n");

  // ============================================================
  // STEP 2: From 8310412768 send "Hi"
  // ============================================================
  console.log('STEP 2: Authorized Customer (8310412768) sends "Hi"');
  metaApiCalls = [];
  aiCalls = [];
  const baseTime = Date.now();

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_step2",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "phone_id_for_97142725202",
                display_phone_number: "+97142725202",
              },
              messages: [
                {
                  from: "8310412768",
                  id: "wamid.step2_msg",
                  timestamp: String(Math.floor(baseTime / 1000)),
                  type: "text",
                  text: { body: "Hi" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 1, "AI flow must execute for authorized customer");
  assert.equal(metaApiCalls.length, 1, "Outbound reply must be sent");
  assert.equal(
    allowlistPolicy.isAuthorized(metaApiCalls[0].to),
    true,
    "Outbound reply must be directed TO authorized customer (+918310412768)",
  );
  assert.equal(
    metaApiCalls[0].fromPhoneNumberId,
    "phone_id_for_97142725202",
    "Outbound message must be sent FROM bot number phone ID",
  );
  console.log("✅ STEP 2 PASSED: Authorized customer received reply sent from bot number\n");

  // ============================================================
  // STEP 3: From another number send "Hi" -> Silently ignored
  // ============================================================
  console.log('STEP 3: Unauthorized number sends "Hi"');
  metaApiCalls = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_step3",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "phone_id_for_97142725202",
                display_phone_number: "+97142725202",
              },
              messages: [
                {
                  from: "+919999999999",
                  id: "wamid.step3_unauth",
                  timestamp: String(Math.floor((baseTime + 1000) / 1000)),
                  type: "text",
                  text: { body: "Hi" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0, "AI must NOT run for unauthorized number");
  assert.equal(metaApiCalls.length, 0, "0 outbound messages for unauthorized number");
  console.log("✅ STEP 3 PASSED: Unauthorized sender silently ignored with 0 AI and 0 response\n");

  // ============================================================
  // STEP 4: Restart backend -> No proactive WhatsApp message
  // ============================================================
  console.log("STEP 4: Restart backend simulation");
  metaApiCalls = [];
  aiCalls = [];

  const restartedService = new WhatsAppService(
    mockApiService,
    windowPolicy,
    outboundPolicy,
    null,
    mockConversationRepo,
    realtimeService,
    mockAiService,
    null,
    allowlistPolicy,
  );

  assert.equal(metaApiCalls.length, 0, "Restarted backend must send 0 messages");
  assert.equal(aiCalls.length, 0, "Restarted backend must execute 0 AI calls");
  console.log("✅ STEP 4 PASSED: No proactive message on restart\n");

  // ============================================================
  // STEP 5: Send another message from 8310412768 -> AI responds normally
  // ============================================================
  console.log("STEP 5: Authorized customer sends follow-up after restart");
  metaApiCalls = [];
  aiCalls = [];

  await restartedService.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_step5",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "phone_id_for_97142725202",
                display_phone_number: "+97142725202",
              },
              messages: [
                {
                  from: "+918310412768",
                  id: "wamid.step5_msg",
                  timestamp: String(Math.floor((baseTime + 2000) / 1000)),
                  type: "text",
                  text: { body: "What are your business card sizes?" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 1, "AI must respond to authorized follow-up");
  assert.equal(metaApiCalls.length, 1, "Outbound message must be sent");
  assert.equal(allowlistPolicy.isAuthorized(metaApiCalls[0].to), true);
  console.log("✅ STEP 5 PASSED: Authorized customer follow-up processed normally\n");

  // ============================================================
  // Test Inbound Trigger Protection on Proactive / Cron Attempts
  // ============================================================
  console.log("Verifying Proactive & Legacy Triggers are Strictly Blocked");
  const proactiveAttempt = await restartedService.sendMessage(
    "8310412768",
    { type: "text", text: { body: "Proactive alert" } },
  );
  assert.equal(proactiveAttempt.sent, false);
  assert.equal(proactiveAttempt.blocked, true);
  assert.equal(proactiveAttempt.reason, "WHATSAPP_INBOUND_TRIGGER_REQUIRED");

  const legacyProactiveAttempt = await sendWhatsAppMessage({
    phone: "8310412768",
    message: "Proactive reminder",
  });
  assert.equal(legacyProactiveAttempt.sent, false);
  assert.equal(legacyProactiveAttempt.blocked, true);
  assert.equal(legacyProactiveAttempt.reason, "WHATSAPP_INBOUND_TRIGGER_REQUIRED");
  console.log("✅ Proactive / Cron / Legacy outbound calls strictly blocked without inbound trigger\n");

  console.log("=================================================");
  console.log("🎉 ALL INBOUND-ONLY & SINGLE SENDER SCENARIOS PASSED!");
  console.log("=================================================");
}

runInboundOnlySingleSenderSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
