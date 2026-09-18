import assert from "node:assert/strict";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy, {
  OutboundBlockReasons,
} from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import sendWhatsAppMessage from "../../services/whatsappService.js";
import AIService from "../../services/AIService.js";
import AIController from "../../controllers/aiController.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING WHATSAPP 100% INBOUND-ONLY ENFORCEMENT");
  process.env.WHATSAPP_ACCESS_TOKEN = "mock_access_token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "mock_phone_number_id";
  process.env.WHATSAPP_VERIFY_TOKEN = "test_verify_token_123";
  process.env.WHATSAPP_APP_SECRET = "test_app_secret_456";

  const windowPolicy = new WhatsAppCustomerServiceWindowPolicy();
  const outboundPolicy = new WhatsAppOutboundPolicy({ windowPolicy });
  let metaApiCalls = [];

  const mockApiService = new WhatsAppApiService({
    accessToken: "mock_access_token",
    phoneNumberId: "mock_phone_number_id",
  });

  mockApiService.sendMessage = async (to, message) => {
    metaApiCalls.push({ to, message });
    return { messages: [{ id: `wamid.mock_${Date.now()}` }] };
  };

  const whatsappService = new WhatsAppService(
    mockApiService,
    windowPolicy,
    outboundPolicy,
  );

  // ============================================================
  // Test 1: Application startup / initialization sends 0 messages
  // ============================================================
  console.log("Test 1: Startup & Service Instantiation sends NO messages");
  metaApiCalls = [];
  const aiService = new AIService();
  const aiController = new AIController();
  const newWindowPolicy = new WhatsAppCustomerServiceWindowPolicy();
  const newOutboundPolicy = new WhatsAppOutboundPolicy();
  const freshService = new WhatsAppService(mockApiService);

  assert.equal(metaApiCalls.length, 0, "Startup must make 0 Meta API calls");
  console.log("✅ Test 1 passed: 0 Meta API calls during startup\n");

  // ============================================================
  // Test 2: Attempt send WITHOUT inbound trigger context is BLOCKED
  // ============================================================
  console.log("Test 2: Direct send without inbound trigger is BLOCKED");
  metaApiCalls = [];
  const resNoTrigger = await whatsappService.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Proactive message attempt" } },
  );

  assert.equal(resNoTrigger.sent, false);
  assert.equal(resNoTrigger.blocked, true);
  assert.equal(
    resNoTrigger.reason,
    OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED,
  );
  assert.equal(metaApiCalls.length, 0, "Meta API must not be called");
  console.log("✅ Test 2 passed: Direct send blocked with WHATSAPP_INBOUND_TRIGGER_REQUIRED\n");

  // ============================================================
  // Test 3: Attempt send with triggeredByInboundMessage: false is BLOCKED
  // ============================================================
  console.log("Test 3: Send with triggeredByInboundMessage: false is BLOCKED");
  metaApiCalls = [];
  const resTriggerFalse = await whatsappService.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Scheduled reminder" } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: false,
        inboundMessageId: "wamid.123",
        customerWaId: "971501111111",
      },
    },
  );

  assert.equal(resTriggerFalse.sent, false);
  assert.equal(resTriggerFalse.blocked, true);
  assert.equal(
    resTriggerFalse.reason,
    OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED,
  );
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 3 passed: triggeredByInboundMessage=false blocked\n");

  // ============================================================
  // Test 4: Missing inbound message ID is BLOCKED
  // ============================================================
  console.log("Test 4: Missing inbound message ID is BLOCKED");
  metaApiCalls = [];
  const resMissingMsgId = await whatsappService.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Response text" } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "",
        customerWaId: "971501111111",
        inboundReceivedAt: Date.now(),
      },
    },
  );

  assert.equal(resMissingMsgId.sent, false);
  assert.equal(resMissingMsgId.blocked, true);
  assert.equal(
    resMissingMsgId.reason,
    OutboundBlockReasons.INVALID_INBOUND_MESSAGE,
  );
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 4 passed: Missing inbound message ID blocked\n");

  // ============================================================
  // Test 5: Missing customer WA ID is BLOCKED
  // ============================================================
  console.log("Test 5: Missing customer WA ID is BLOCKED");
  metaApiCalls = [];
  const resMissingWaId = await whatsappService.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Response text" } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.123",
        customerWaId: null,
        inboundReceivedAt: Date.now(),
      },
    },
  );

  assert.equal(resMissingWaId.sent, false);
  assert.equal(resMissingWaId.blocked, true);
  assert.equal(
    resMissingWaId.reason,
    OutboundBlockReasons.INVALID_CUSTOMER_IDENTITY,
  );
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 5 passed: Missing customer WA ID blocked\n");

  // ============================================================
  // Test 6: Recipient mismatch between inbound customer and outbound recipient is BLOCKED
  // ============================================================
  console.log("Test 6: Recipient mismatch is BLOCKED");
  metaApiCalls = [];
  const baseTime = Date.now();
  windowPolicy.recordInboundCustomerMessage("971501111111", baseTime);

  const resMismatch = await whatsappService.sendMessage(
    "971509999999", // Attempting to send to customer B
    { type: "text", text: { body: "Response intended for customer A" } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.custA_01",
        customerWaId: "971501111111", // Inbound was customer A
        inboundReceivedAt: baseTime,
      },
    },
  );

  assert.equal(resMismatch.sent, false);
  assert.equal(resMismatch.blocked, true);
  assert.equal(
    resMismatch.reason,
    OutboundBlockReasons.OUTBOUND_RECIPIENT_MISMATCH,
  );
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 6 passed: Cross-recipient send blocked with OUTBOUND_RECIPIENT_MISMATCH\n");

  // ============================================================
  // Test 7: Customer Prompt Injection cannot bypass recipient binding
  // ============================================================
  console.log("Test 7: Prompt injection cannot alter outbound recipient");
  metaApiCalls = [];
  const injectedRecipient = "919876543210";
  const verifiedCustomer = "971501111111";

  const resInjection = await whatsappService.sendMessage(
    injectedRecipient,
    { type: "text", text: { body: "Injected prompt redirect attempt" } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.inj_001",
        customerWaId: verifiedCustomer,
        inboundReceivedAt: Date.now(),
      },
    },
  );

  assert.equal(resInjection.sent, false);
  assert.equal(resInjection.blocked, true);
  assert.equal(
    resInjection.reason,
    OutboundBlockReasons.OUTBOUND_RECIPIENT_MISMATCH,
  );
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 7 passed: Prompt injection recipient redirect blocked\n");

  // ============================================================
  // Test 8: Valid inbound customer message authorizes response to SAME customer inside window
  // ============================================================
  console.log("Test 8: Valid inbound message authorizes response to SAME customer");
  metaApiCalls = [];
  const validInboundTime = Date.now();
  const customerPhone = "971501234567";
  windowPolicy.recordInboundCustomerMessage(customerPhone, validInboundTime);

  const resValid = await whatsappService.sendMessage(
    customerPhone,
    { type: "text", text: { body: "Hello! Here are our business card options." } },
    {
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.valid_001",
        customerWaId: customerPhone,
        inboundReceivedAt: validInboundTime,
      },
      now: validInboundTime + 1000,
    },
  );

  assert.equal(resValid.sent, true);
  assert.equal(resValid.blocked, false);
  assert.equal(metaApiCalls.length, 1);
  assert.equal(metaApiCalls[0].to, customerPhone);
  console.log("✅ Test 8 passed: Valid inbound response successfully dispatched to Meta API\n");

  // ============================================================
  // Test 9: Helper methods (sendTextMessage, sendButtonMessage, sendListMessage) enforce guard
  // ============================================================
  console.log("Test 9: Helper methods (sendText, sendButton, sendList) enforce inbound guard");
  metaApiCalls = [];

  // Without trigger context
  const textBlocked = await whatsappService.sendTextMessage(
    customerPhone,
    "Follow up message",
  );
  assert.equal(textBlocked.blocked, true);
  assert.equal(textBlocked.reason, OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED);

  const buttonBlocked = await whatsappService.sendButtonMessage(
    customerPhone,
    "Follow up buttons",
    [{ id: "b1", title: "Option 1" }],
  );
  assert.equal(buttonBlocked.blocked, true);
  assert.equal(buttonBlocked.reason, OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED);

  const listBlocked = await whatsappService.sendListMessage(
    customerPhone,
    "Follow up list",
    "View",
    [{ title: "Section", rows: [{ id: "r1", title: "Row" }] }],
  );
  assert.equal(listBlocked.blocked, true);
  assert.equal(listBlocked.reason, OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED);
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 9 passed: All helper methods strictly enforce inbound trigger guard\n");

  // ============================================================
  // Test 10: Legacy services/whatsappService.js blocks send without inbound trigger
  // ============================================================
  console.log("Test 10: Legacy services/whatsappService.js blocks unauthenticated send");
  const legacyBlocked = await sendWhatsAppMessage({
    phone: "971501234567",
    message: "Proactive alert",
  });
  assert.equal(legacyBlocked.sent, false);
  assert.equal(legacyBlocked.blocked, true);
  assert.ok(
    legacyBlocked.reason === "WHATSAPP_INBOUND_TRIGGER_REQUIRED" ||
      legacyBlocked.reason === "UNAUTHORIZED_RECIPIENT",
  );
  console.log("✅ Test 10 passed: Legacy sendWhatsAppMessage blocked without inbound trigger\n");

  // ============================================================
  // Test 11: Website Chat (/ai/chat) does not grant WhatsApp outbound send authorization
  // ============================================================
  console.log("Test 11: Website chat channel does not gain WhatsApp send authorization");
  metaApiCalls = [];
  aiService.loadConversation = async ({ sessionId }) => ({
    sessionId,
    customer: {},
    messages: [],
    status: "ACTIVE",
    workflow: "NONE",
  });
  aiService.getGraph = () => ({
    invoke: async (state) => ({
      ...state,
      response: { type: "message", message: "Hello from Web Assistant" },
    }),
  });

  const webResult = await aiService.chat({
    sessionId: "web_session_12345",
    site: "exprintmart",
    message: "I need business cards",
  });

  assert.equal(webResult.success, true);
  // Web chat MUST NOT have triggered any WhatsApp Meta API calls
  assert.equal(metaApiCalls.length, 0, "Web chat must never call Meta API");
  console.log("✅ Test 11 passed: Web chat processed without WhatsApp send authorization\n");

  // ============================================================
  // Test 12: Scheduled / Cron / Background Follow-up Attempt is BLOCKED
  // ============================================================
  console.log("Test 12: Scheduled / Background follow-up attempts are BLOCKED");
  metaApiCalls = [];
  const fakeScheduledTask = async () => {
    // Attempting to send reminder to customer who messaged earlier
    return whatsappService.sendMessage(customerPhone, {
      type: "text",
      text: { body: "Are you still interested in printing?" },
    });
  };

  const cronResult = await fakeScheduledTask();
  assert.equal(cronResult.sent, false);
  assert.equal(cronResult.blocked, true);
  assert.equal(cronResult.reason, OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED);
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 12 passed: Scheduled follow-up strictly blocked\n");

  console.log("=================================================");
  console.log("🎉 ALL 12 INBOUND-ONLY TESTS PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
