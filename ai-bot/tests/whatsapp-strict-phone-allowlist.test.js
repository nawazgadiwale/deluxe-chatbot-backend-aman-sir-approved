import assert from "node:assert/strict";
import crypto from "crypto";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppRealtimeService from "../modules/whatsapp/services/WhatsAppRealtimeService.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import WhatsAppAllowlistPolicy, {
  AUTHORIZED_E164_PHONE,
  AUTHORIZED_DIGITS_PHONE,
} from "../modules/whatsapp/policies/WhatsAppAllowlistPolicy.js";

async function runStrictAllowlistTests() {
  console.log("=================================================");
  console.log("🔒 STRICT PHONE ALLOWLIST TEST SUITE (+918310412768)");
  console.log("=================================================\n");

  // Ensure clean environment
  delete process.env.WHATSAPP_TEST_SENDER;
  delete process.env.WHATSAPP_TEST_ALLOWLIST;
  delete process.env.WHATSAPP_AUTHORIZED_NUMBER;

  // Verify default policy constants
  const policy = new WhatsAppAllowlistPolicy();
  assert.equal(policy.getAuthorizedE164(), "+918310412768");
  assert.equal(policy.normalizeToE164("8310412768"), "+918310412768");
  assert.equal(policy.normalizeToE164("918310412768"), "+918310412768");
  assert.equal(policy.normalizeToE164("+918310412768"), "+918310412768");
  assert.equal(policy.normalizeToE164("08310412768"), "+918310412768");
  assert.equal(policy.normalizeToE164("+91 83104 12768"), "+918310412768");
  assert.equal(policy.normalizeToE164("83104-12768"), "+918310412768");
  assert.equal(policy.normalizeToE164("8310412768@c.us"), "+918310412768");
  assert.equal(policy.normalizeToE164("8310412768@s.whatsapp.net"), "+918310412768");

  // Verify strict equality - rejection of prefix, suffix, endsWith tricks
  assert.equal(policy.isAuthorized("8310412768"), true);
  assert.equal(policy.isAuthorized("+918310412768"), true);
  assert.equal(policy.isAuthorized("918310412768"), true);
  assert.equal(policy.isAuthorized("+18310412768"), false); // US number ending with same digits
  assert.equal(policy.isAuthorized("18310412768"), false);
  assert.equal(policy.isAuthorized("91918310412768"), false);
  assert.equal(policy.isAuthorized("1238310412768"), false);
  assert.equal(policy.isAuthorized("9876543210"), false);
  assert.equal(policy.isAuthorized("+919876543210"), false);
  assert.equal(policy.isAuthorized(""), false);
  assert.equal(policy.isAuthorized(null), false);
  assert.equal(policy.isAuthorized(undefined), false);
  assert.equal(policy.isAuthorized("invalid_phone"), false);
  assert.equal(policy.isAuthorized("12345"), false);

  console.log("✅ Basic normalization and strict comparison tests passed\n");

  // Setup mock infrastructure for WhatsAppService
  let outboundMessages = [];
  const mockApiService = {
    accessToken: "mock_token",
    phoneNumberId: "phone_id_1001",
    sendMessage: async (to, message) => {
      outboundMessages.push({ to, message, timestamp: Date.now() });
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
        messages: [{ role: "assistant", content: "Hello! AI response from ExprintMart." }],
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
  // Test 1: +918310412768 sends "Hi" -> AI responds
  // ============================================================
  console.log('Test 1: +918310412768 sends "Hi" -> AI responds');
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "+918310412768",
                  id: "wamid.test1",
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

  assert.equal(aiCalls.length, 1);
  assert.equal(outboundMessages.length, 1);
  assert.equal(aiCalls[0].message, "Hi");
  console.log("✅ Test 1 passed: +918310412768 received AI response\n");

  // ============================================================
  // Test 2: 8310412768 sends an order request -> AI processes normally
  // ============================================================
  console.log("Test 2: 8310412768 sends an order request -> AI processes normally");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_2",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "8310412768",
                  id: "wamid.test2",
                  timestamp: String(Math.floor((baseTime + 1000) / 1000)),
                  type: "text",
                  text: { body: "I want to order 500 business cards" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 1);
  assert.equal(outboundMessages.length, 1);
  assert.equal(aiCalls[0].message, "I want to order 500 business cards");
  console.log("✅ Test 2 passed: 8310412768 order request processed normally\n");

  // ============================================================
  // Test 3: Another Indian number sends "Hi" -> NO response, NO DB mutation
  // ============================================================
  console.log('Test 3: Another Indian number sends "Hi" -> NO response, NO AI');
  outboundMessages = [];
  aiCalls = [];
  const initialStoreSize = memoryStore.size;

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_3",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "+919876543210",
                  id: "wamid.test3",
                  timestamp: String(Math.floor((baseTime + 2000) / 1000)),
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

  assert.equal(aiCalls.length, 0); // Zero AI
  assert.equal(outboundMessages.length, 0); // Zero outbound messages
  assert.equal(memoryStore.size, initialStoreSize); // Zero new conversations created
  console.log("✅ Test 3 passed: Another Indian number silently rejected\n");

  // ============================================================
  // Test 4: Another Indian number sends an order request -> NO AI and NO response
  // ============================================================
  console.log("Test 4: Another Indian number sends an order request -> NO AI and NO response");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_4",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "9876543210",
                  id: "wamid.test4",
                  timestamp: String(Math.floor((baseTime + 3000) / 1000)),
                  type: "text",
                  text: { body: "I want to place an order for flyers" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 4 passed: Unauthorized order request rejected silently\n");

  // ============================================================
  // Test 5: Another country number sends a message -> NO response
  // ============================================================
  console.log("Test 5: Another country number sends a message -> NO response");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_5",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "+15551234567",
                  id: "wamid.test5",
                  timestamp: String(Math.floor((baseTime + 4000) / 1000)),
                  type: "text",
                  text: { body: "Hello from US" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 5 passed: Non-India international number rejected silently\n");

  // ============================================================
  // Test 6: Unauthorized number sends a malformed message -> NO AI processing
  // ============================================================
  console.log("Test 6: Unauthorized number sends a malformed message -> NO AI processing");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_6",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "9999999999",
                  id: "wamid.test6",
                  timestamp: "not_a_timestamp",
                  type: "unknown_weird_type",
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 6 passed: Malformed unauthorized message rejected\n");

  // ============================================================
  // Test 7: Unauthorized number sends repeated messages -> NO AI processing
  // ============================================================
  console.log("Test 7: Unauthorized number sends repeated messages -> NO AI processing");
  outboundMessages = [];
  aiCalls = [];

  for (let i = 0; i < 3; i++) {
    await service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: `wamid_entry_7_${i}`,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_1001" },
                messages: [
                  {
                    from: "919811111111",
                    id: `wamid.test7_${i}`,
                    timestamp: String(Math.floor((baseTime + 5000 + i * 1000) / 1000)),
                    type: "text",
                    text: { body: `Spam attempt ${i}` },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  }

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 7 passed: Repeated unauthorized messages rejected\n");

  // ============================================================
  // Test 8: Unauthorized number sends a Flow payload -> DO NOT process it
  // ============================================================
  console.log("Test 8: Unauthorized number sends a Flow payload -> DO NOT process it");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_8",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "919999999999",
                  id: "wamid.test8_flow",
                  timestamp: String(Math.floor((baseTime + 10000) / 1000)),
                  type: "interactive",
                  interactive: {
                    type: "nfm_reply",
                    nfm_reply: {
                      response_json: JSON.stringify({ product: "visiting-cards", qty: 100 }),
                      name: "flow_submission",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 8 passed: Unauthorized Flow payload rejected without processing\n");

  // ============================================================
  // Test 9: Unauthorized number attempts to reuse an existing session identifier -> MUST NOT gain access
  // ============================================================
  console.log("Test 9: Unauthorized number attempts to reuse existing session identifier");
  outboundMessages = [];
  aiCalls = [];

  const authorizedSessionId = "whatsapp:phone_id_1001:918310412768";
  // Verify authorized session exists from Test 1 & 2
  const authorizedConv = await mockConversationRepo.findBySessionId(authorizedSessionId);
  assert.notEqual(authorizedConv, null);
  const authorizedMsgCount = authorizedConv.messages.length;

  // Attacker sends message attempting to claim the authorized sessionId
  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_9",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "9988776655", // Attacker number
                  id: "wamid.test9_spoof",
                  timestamp: String(Math.floor((baseTime + 12000) / 1000)),
                  type: "text",
                  text: { body: "Spoofed attempt" },
                  sessionId: authorizedSessionId,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  // Verify attacker gained NO access and the authorized session was NOT mutated
  const untouchedConv = await mockConversationRepo.findBySessionId(authorizedSessionId);
  assert.equal(untouchedConv.messages.length, authorizedMsgCount);
  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 9 passed: Session isolation strictly preserved\n");

  // ============================================================
  // Test 10: Authorized number continues an existing conversation -> Works normally across representations
  // ============================================================
  console.log("Test 10: Authorized number continues existing conversation across representations");
  outboundMessages = [];
  aiCalls = [];

  // Authorized user continues conversation using E.164 with plus
  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_10",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "+918310412768",
                  id: "wamid.test10_continue",
                  timestamp: String(Math.floor((baseTime + 15000) / 1000)),
                  type: "text",
                  text: { body: "Can you confirm the total price?" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 1);
  assert.equal(outboundMessages.length, 1);
  // Same session ID was reused
  assert.equal(aiCalls[0].sessionId, authorizedSessionId);
  const updatedConv = await mockConversationRepo.findBySessionId(authorizedSessionId);
  assert.equal(updatedConv.messages.length > authorizedMsgCount, true);
  console.log("✅ Test 10 passed: Authorized number conversation smoothly continued\n");

  // ============================================================
  // Test 11: WhatsApp status/read events must NOT trigger AI replies
  // ============================================================
  console.log("Test 11: WhatsApp status/read events must NOT trigger AI replies");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_11",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              statuses: [
                {
                  id: "wamid.test1",
                  status: "delivered",
                  timestamp: String(Math.floor((baseTime + 16000) / 1000)),
                  recipient_id: "918310412768",
                },
                {
                  id: "wamid.test1",
                  status: "read",
                  timestamp: String(Math.floor((baseTime + 17000) / 1000)),
                  recipient_id: "918310412768",
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0); // Zero AI calls
  assert.equal(outboundMessages.length, 0); // Zero outbound messages
  console.log("✅ Test 11 passed: Status and delivery events did not trigger AI\n");

  // ============================================================
  // Test 12: Missing / invalid sender number -> fail closed with NO outbound response
  // ============================================================
  console.log("Test 12: Missing / invalid sender number -> fail closed with NO response");
  outboundMessages = [];
  aiCalls = [];

  // Missing 'from'
  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_12_missing",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  id: "wamid.test12_missing",
                  timestamp: String(Math.floor((baseTime + 18000) / 1000)),
                  type: "text",
                  text: { body: "Where is my sender?" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  // Invalid 'from'
  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_12_invalid",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "not-a-number",
                  id: "wamid.test12_invalid",
                  timestamp: String(Math.floor((baseTime + 19000) / 1000)),
                  type: "text",
                  text: { body: "Invalid number" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Test 12 passed: Missing and invalid sender numbers failed closed\n");

  // ============================================================
  // Extra Test: US number ending in 8310412768 (+18310412768) -> REJECTED
  // ============================================================
  console.log("Extra Test: +18310412768 (US number ending in 8310412768) -> REJECTED");
  outboundMessages = [];
  aiCalls = [];

  await service.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wamid_entry_us",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone_id_1001" },
              messages: [
                {
                  from: "+18310412768",
                  id: "wamid.test_us",
                  timestamp: String(Math.floor((baseTime + 20000) / 1000)),
                  type: "text",
                  text: { body: "US spoof attempt" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(aiCalls.length, 0);
  assert.equal(outboundMessages.length, 0);
  console.log("✅ Extra Test passed: Non-Indian number ending in authorized digits was rejected\n");

  console.log("=================================================");
  console.log("🎉 ALL 12 TEST REQUIREMENTS SUCCESSFULLY PASSED!");
  console.log("=================================================");
}

runStrictAllowlistTests().catch((err) => {
  console.error("❌ Strict allowlist test failed:", err);
  process.exit(1);
});
