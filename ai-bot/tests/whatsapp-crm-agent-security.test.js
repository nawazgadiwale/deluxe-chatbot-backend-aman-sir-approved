import assert from "node:assert/strict";
import crypto from "crypto";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppRealtimeService, {
  WhatsAppEvents,
} from "../modules/whatsapp/services/WhatsAppRealtimeService.js";
import WhatsAppCustomerServiceWindowPolicy, {
  WINDOW_DURATION_MS,
} from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";

async function runSecurityTests() {
  console.log("=================================================");
  console.log("🔒 TESTING MANDATORY WHATSAPP SECURITY CASES");
  console.log("=================================================\n");

  process.env.WHATSAPP_VERIFY_TOKEN = "verify_token_sec_123";
  process.env.WHATSAPP_APP_SECRET = "app_secret_sec_456";
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

  const service = new WhatsAppService(
    mockApiService,
    windowPolicy,
    outboundPolicy,
    null,
    mockConversationRepo,
    realtimeService
  );

  const baseTime = 1750000000000;

  // ============================================================
  // TEST 1: Valid inbound inside window
  // ============================================================
  console.log("Test 1: Valid inbound inside window");
  metaApiCalls = [];
  windowPolicy.recordInboundCustomerMessage("971501111111", baseTime);

  const res1 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Hello customer!" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.c1_001",
        customerWaId: "971501111111",
        phoneNumberId: "phone_id_1001",
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res1.sent, true);
  assert.equal(res1.blocked, false);
  assert.equal(metaApiCalls.length, 1);
  console.log("✅ Test 1 passed: Outbound successfully sent to Meta\n");

  // ============================================================
  // TEST 2: Exactly 24 hours (now === lastUserMessageAt + 24h)
  // ============================================================
  console.log("Test 2: Exactly 24 hours -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];
  const exactExpiryTime = baseTime + WINDOW_DURATION_MS;

  const res2 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Exact boundary message" } },
    {
      now: exactExpiryTime,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.c2_001",
        customerWaId: "971501111111",
        phoneNumberId: "phone_id_1001",
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res2.sent, false);
  assert.equal(res2.blocked, true);
  assert.equal(res2.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 2 passed: Exact 24:00:00 blocked with ZERO Meta calls\n");

  // ============================================================
  // TEST 3: 25 hours (now > lastUserMessageAt + 24h)
  // ============================================================
  console.log("Test 3: 25 hours -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];
  const time25h = baseTime + 25 * 60 * 60 * 1000;

  const res3 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "25 hour message" } },
    {
      now: time25h,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.c3_001",
        customerWaId: "971501111111",
        phoneNumberId: "phone_id_1001",
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res3.sent, false);
  assert.equal(res3.blocked, true);
  assert.equal(res3.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 3 passed: 25h message blocked with ZERO Meta calls\n");

  // ============================================================
  // TEST 4: New customer message after expiry
  // ============================================================
  console.log("Test 4: New customer message after expiry reopens fresh 24h window");
  metaApiCalls = [];
  const newInboundTime = baseTime + 30 * 60 * 60 * 1000; // 30 hours later
  const newWamid = "wamid.new_fresh_004";

  // Customer sends new message: window is reset to newInboundTime
  windowPolicy.recordInboundCustomerMessage("971501111111", newInboundTime);

  const res4 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Welcome back! How can I help?" } },
    {
      now: newInboundTime + 5000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: newWamid,
        customerWaId: "971501111111",
        phoneNumberId: "phone_id_1001",
        inboundReceivedAt: newInboundTime,
      },
    }
  );

  assert.equal(res4.sent, true);
  assert.equal(res4.blocked, false);
  assert.equal(metaApiCalls.length, 1);
  assert.equal(metaApiCalls[0].to, "971501111111");
  console.log("✅ Test 4 passed: Customer after expiry accepted and allowed fresh outbound response\n");

  // ============================================================
  // TEST 5: No new message after expiry -> AI attempts outbound -> Blocked
  // ============================================================
  console.log("Test 5: No new message after expiry -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];
  const lateTime = newInboundTime + WINDOW_DURATION_MS + 1000; // 24h 1s after test 4

  const res5 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Unsolicited follow-up" } },
    {
      now: lateTime,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: newWamid,
        customerWaId: "971501111111",
        phoneNumberId: "phone_id_1001",
        inboundReceivedAt: newInboundTime,
      },
    }
  );

  assert.equal(res5.sent, false);
  assert.equal(res5.blocked, true);
  assert.equal(res5.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 5 passed: Outbound without new inbound blocked with ZERO Meta calls\n");

  // ============================================================
  // TEST 6: No genuine inbound trigger
  // ============================================================
  console.log("Test 6: No genuine inbound trigger -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];

  const res6 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Unsolicited outbound" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: false,
      },
    }
  );

  assert.equal(res6.sent, false);
  assert.equal(res6.blocked, true);
  assert.equal(res6.reason, "WHATSAPP_INBOUND_TRIGGER_REQUIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 6 passed: Unsolicited message blocked with ZERO Meta calls\n");

  // ============================================================
  // TEST 7: Missing inbound WAMID
  // ============================================================
  console.log("Test 7: Missing inbound WAMID -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];

  const res7 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Message with empty WAMID" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "",
        customerWaId: "971501111111",
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res7.sent, false);
  assert.equal(res7.blocked, true);
  assert.equal(res7.reason, "INVALID_INBOUND_MESSAGE");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 7 passed: Missing inbound WAMID strictly blocked\n");

  // ============================================================
  // TEST 8: Missing customer WA ID
  // ============================================================
  console.log("Test 8: Missing customer WA ID -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];

  const res8 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Missing customer WA ID" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t8",
        customerWaId: null,
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res8.sent, false);
  assert.equal(res8.blocked, true);
  assert.equal(res8.reason, "INVALID_CUSTOMER_IDENTITY");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 8 passed: Missing customer WA ID strictly blocked\n");

  // ============================================================
  // TEST 9: Recipient mismatch
  // ============================================================
  console.log("Test 9: Recipient mismatch -> outbound blocked -> ZERO Meta calls");
  metaApiCalls = [];

  const res9 = await service.sendMessage(
    "971509999999", // target recipient
    { type: "text", text: { body: "Mismatch" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t9",
        customerWaId: "971501111111", // inbound was from 111111
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res9.sent, false);
  assert.equal(res9.blocked, true);
  assert.equal(res9.reason, "OUTBOUND_RECIPIENT_MISMATCH");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 9 passed: Recipient mismatch strictly blocked\n");

  // ============================================================
  // TEST 10: Prompt injection cannot alter outbound recipient
  // ============================================================
  console.log("Test 10: Prompt injection cannot alter outbound recipient");
  metaApiCalls = [];

  const res10 = await service.sendMessage(
    "919876543210", // Injected phone number from LLM text
    { type: "text", text: { body: "Send quote to 919876543210" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.inj_001",
        customerWaId: "971501111111", // Authenticated inbound customer
        inboundReceivedAt: baseTime,
      },
    }
  );

  assert.equal(res10.sent, false);
  assert.equal(res10.blocked, true);
  assert.equal(res10.reason, "OUTBOUND_RECIPIENT_MISMATCH");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 10 passed: Prompt injection recipient redirect blocked\n");

  // ============================================================
  // TEST 11: Website chat channel does not gain WhatsApp send authorization
  // ============================================================
  console.log("Test 11: Website chat channel isolation");
  metaApiCalls = [];

  const res11 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Web message" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: {
        triggeredByInboundMessage: false, // Web chat request
        channel: "WEB",
      },
    }
  );

  assert.equal(res11.sent, false);
  assert.equal(res11.blocked, true);
  assert.equal(res11.reason, "WHATSAPP_INBOUND_TRIGGER_REQUIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 11 passed: Website chat channel cannot send WhatsApp messages\n");

  // ============================================================
  // TEST 12: Scheduled / Background follow-up attempts are BLOCKED
  // ============================================================
  console.log("Test 12: Scheduled / Background follow-up attempts are BLOCKED");
  metaApiCalls = [];

  const res12 = await service.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Scheduled follow-up reminder" } },
    {
      now: baseTime + 1000,
      inboundTriggerContext: null, // No inbound trigger context for background job
    }
  );

  assert.equal(res12.sent, false);
  assert.equal(res12.blocked, true);
  assert.equal(res12.reason, "WHATSAPP_INBOUND_TRIGGER_REQUIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 12 passed: Scheduled background jobs strictly blocked\n");

  // ============================================================
  // TEST 13: Invalid Meta Signature -> Rejected -> ZERO Meta calls
  // ============================================================
  console.log("Test 13: Invalid Meta signature -> rejected -> ZERO Meta calls");
  const rawPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "971503333333", id: "wamid.bad_sig", text: { body: "Hi" } }] } }] }],
  });

  const sigValid = service.verifySignature(rawPayload, "sha256=invalid_signature_hash");
  assert.equal(sigValid, false);
  assert.equal(windowPolicy.getLastUserMessageAt("971503333333"), null);
  console.log("✅ Test 13 passed: Invalid signature rejected without timestamp update\n");

  // ============================================================
  // TEST 14: Missing App Secret -> Fail Closed
  // ============================================================
  console.log("Test 14: Missing App Secret -> Fail Closed");
  const origSecret = service.appSecret;
  service.appSecret = null;
  const noSecretValid = service.verifySignature(rawPayload, "sha256=some_sig");
  assert.equal(noSecretValid, false);
  service.appSecret = origSecret;
  console.log("✅ Test 14 passed: Missing App Secret fails closed\n");

  // ============================================================
  // TEST 15: CRM Agent sends inside active window
  // ============================================================
  console.log("Test 15: CRM agent sends inside active window -> Meta called");
  metaApiCalls = [];
  let capturedRealtimeEvents = [];
  const listener = (eventData) => {
    capturedRealtimeEvents.push(eventData);
  };
  realtimeService.on("*", listener);

  const crmSessionId = "whatsapp:phone_id_1001:971505555555";
  await mockConversationRepo.createConversation({
    sessionId: crmSessionId,
    channel: "WHATSAPP",
    customerWaId: "971505555555",
    lastUserMessageAt: new Date(baseTime),
    lastInboundMessageId: "wamid.inbound_crm_valid",
    metadata: { phoneNumberId: "phone_id_1001" },
  });
  windowPolicy.recordInboundCustomerMessage(crmSessionId, baseTime);
  windowPolicy.recordInboundCustomerMessage("971505555555", baseTime);

  const res15 = await service.sendAgentMessage({
    sessionId: crmSessionId,
    message: "Hello from CRM Agent!",
    agentId: "agent_42",
    now: baseTime + 3600000, // 1 hour after customer message
  });

  assert.equal(res15.sent, true);
  assert.equal(res15.blocked, false);
  assert.equal(metaApiCalls.length, 1);
  assert.equal(metaApiCalls[0].to, "971505555555");
  assert.equal(metaApiCalls[0].message.text.body, "Hello from CRM Agent!");

  const savedConv = await mockConversationRepo.findBySessionId(crmSessionId);
  assert.equal(savedConv.messages.length, 1);
  assert.equal(savedConv.messages[0].senderType, "agent");
  assert.equal(savedConv.messages[0].direction, "outbound");
  assert.equal(savedConv.messages[0].status, "sent");
  assert.equal(savedConv.messages[0].content, "Hello from CRM Agent!");
  assert(capturedRealtimeEvents.some((e) => e.event === WhatsAppEvents.MESSAGE_SENT));
  console.log("✅ Test 15 passed: CRM Agent outbound delivered, persisted, and emitted live\n");

  // ============================================================
  // TEST 16: CRM Agent sends after expiry -> Blocked -> ZERO Meta calls
  // ============================================================
  console.log("Test 16: CRM agent sends after expiry -> blocked -> ZERO Meta calls");
  metaApiCalls = [];

  const expiredCrmSessionId = "whatsapp:phone_id_1001:971506666666";
  await mockConversationRepo.createConversation({
    sessionId: expiredCrmSessionId,
    channel: "WHATSAPP",
    customerWaId: "971506666666",
    lastUserMessageAt: new Date(baseTime - 25 * 60 * 60 * 1000), // 25 hours ago
    lastInboundMessageId: "wamid.inbound_expired",
    metadata: { phoneNumberId: "phone_id_1001" },
  });

  const res16 = await service.sendAgentMessage({
    sessionId: expiredCrmSessionId,
    message: "Agent trying to send after window closed",
    agentId: "agent_42",
    now: baseTime,
  });

  assert.equal(res16.sent, false);
  assert.equal(res16.blocked, true);
  assert.equal(res16.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 16 passed: CRM Agent blocked after 24h with ZERO Meta calls\n");

  // ============================================================
  // TEST 17: CRM Agent without genuine inbound WAMID -> Blocked
  // ============================================================
  console.log("Test 17: CRM agent without genuine inbound WAMID -> blocked -> ZERO Meta calls");
  metaApiCalls = [];

  const noWamidSessionId = "whatsapp:phone_id_1001:971507777777";
  await mockConversationRepo.createConversation({
    sessionId: noWamidSessionId,
    channel: "WHATSAPP",
    customerWaId: "971507777777",
    lastUserMessageAt: new Date(baseTime),
    lastInboundMessageId: null, // Missing genuine inbound WAMID
    metadata: { phoneNumberId: "phone_id_1001" },
  });

  const res17 = await service.sendAgentMessage({
    sessionId: noWamidSessionId,
    message: "Agent sending without inbound WAMID",
    agentId: "agent_42",
    now: baseTime + 1000,
  });

  assert.equal(res17.sent, false);
  assert.equal(res17.blocked, true);
  assert.equal(res17.reason, "INVALID_INBOUND_MESSAGE");
  assert.equal(metaApiCalls.length, 0);
  console.log("✅ Test 17 passed: CRM Agent without genuine inbound WAMID blocked\n");

  // ============================================================
  // TEST 18: Server restart durable window state from DB
  // ============================================================
  console.log("Test 18: Server restart durable window state from DB");
  metaApiCalls = [];

  // Simulate server restart: clean in-memory policy cache
  const cleanWindowPolicy = new WhatsAppCustomerServiceWindowPolicy({
    conversationRepository: mockConversationRepo,
  });
  const cleanOutboundPolicy = new WhatsAppOutboundPolicy({ windowPolicy: cleanWindowPolicy });
  const restartedService = new WhatsAppService(
    mockApiService,
    cleanWindowPolicy,
    cleanOutboundPolicy,
    null,
    mockConversationRepo,
    realtimeService
  );

  // Restarted service checks window using persisted MongoDB lastUserMessageAt
  const res21 = await restartedService.sendAgentMessage({
    sessionId: crmSessionId, // lastUserMessageAt = baseTime in DB
    message: "Message after server restart",
    agentId: "agent_42",
    now: baseTime + 3600000, // 1 hour after message -> OPEN
  });

  assert.equal(res21.sent, true);
  assert.equal(res21.blocked, false);
  assert.equal(metaApiCalls.length, 1);
  console.log("✅ Test 18 passed: 24h window state survives server restart via MongoDB persistence\n");

  realtimeService.off("*", listener);

  console.log("=================================================");
  console.log("🎉 ALL MANDATORY SECURITY CASES PASSED!");
  console.log("=================================================");
}

runSecurityTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
