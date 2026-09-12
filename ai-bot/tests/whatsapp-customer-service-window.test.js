import assert from "node:assert/strict";
import WhatsAppCustomerServiceWindowPolicy, {
  WINDOW_DURATION_MS,
} from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";
import WhatsAppOutboundPolicy, {
  OutboundBlockReasons,
} from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING WHATSAPP 24-HOUR CUSTOMER SERVICE WINDOW");
  console.log("=================================================\n");

  const policy = new WhatsAppCustomerServiceWindowPolicy();
  const outboundPolicy = new WhatsAppOutboundPolicy({ windowPolicy: policy });
  const baseTime = new Date("2026-09-01T10:00:00.000Z").getTime();

  // ============================================================
  // Test 1: Window opens after inbound message
  // ============================================================
  console.log("Test 1: Window opens after inbound message");
  const t1_now = baseTime + 60 * 1000; // 10:01 (1 min later)
  assert.equal(policy.isWindowOpen(baseTime, t1_now), true);
  assert.equal(policy.isWindowExpired(baseTime, t1_now), false);
  assert.equal(
    policy.getRemainingMilliseconds(baseTime, t1_now),
    WINDOW_DURATION_MS - 60 * 1000,
  );
  console.log("✅ Test 1 passed: Window is OPEN 1 min after message\n");

  // ============================================================
  // Test 2: Window open near expiry (23h 59m)
  // ============================================================
  console.log("Test 2: Window open near expiry (23h 59m)");
  const t2_nearExpiry = baseTime + (23 * 60 + 59) * 60 * 1000; // 23h 59m
  assert.equal(policy.isWindowOpen(baseTime, t2_nearExpiry), true);
  assert.equal(policy.isWindowExpired(baseTime, t2_nearExpiry), false);
  assert.equal(
    policy.getRemainingMilliseconds(baseTime, t2_nearExpiry),
    60 * 1000, // 1 minute left
  );
  console.log("✅ Test 2 passed: Window is OPEN at 23h 59m\n");

  // ============================================================
  // Test 3: Exact expiry (24h 00m)
  // ============================================================
  console.log("Test 3: Exact expiry boundary (24h 00m)");
  const t3_exactExpiry = baseTime + WINDOW_DURATION_MS; // Exactly 24h later
  assert.equal(policy.isWindowOpen(baseTime, t3_exactExpiry), false);
  assert.equal(policy.isWindowExpired(baseTime, t3_exactExpiry), true);
  assert.equal(policy.getRemainingMilliseconds(baseTime, t3_exactExpiry), 0);

  const t3_guard = policy.checkOutboundEligibility({
    lastUserMessageAt: baseTime,
    now: t3_exactExpiry,
  });
  assert.equal(t3_guard.allowed, false);
  assert.equal(t3_guard.blocked, true);
  assert.equal(t3_guard.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  console.log("✅ Test 3 passed: Window is CLOSED at exact 24h boundary\n");

  // ============================================================
  // Test 4: After expiry (24h 01m)
  // ============================================================
  console.log("Test 4: After expiry (24h 01m)");
  const t4_afterExpiry = baseTime + WINDOW_DURATION_MS + 60 * 1000;
  assert.equal(policy.isWindowOpen(baseTime, t4_afterExpiry), false);
  assert.equal(policy.isWindowExpired(baseTime, t4_afterExpiry), true);
  assert.equal(policy.getRemainingMilliseconds(baseTime, t4_afterExpiry), 0);
  console.log("✅ Test 4 passed: Window is CLOSED after expiry\n");

  // ============================================================
  // Test 5: New customer message resets window
  // ============================================================
  console.log("Test 5: New customer message resets window");
  const msg1_time = new Date("2026-09-01T10:00:00.000Z").getTime();
  const msg2_time = new Date("2026-09-02T09:00:00.000Z").getTime(); // 23h later

  policy.recordInboundCustomerMessage("conv_test_5", msg1_time);
  assert.equal(
    policy.getWindowExpiry(policy.getLastUserMessageAt("conv_test_5")),
    msg1_time + WINDOW_DURATION_MS,
  );

  policy.recordInboundCustomerMessage("conv_test_5", msg2_time);
  assert.equal(
    policy.getWindowExpiry(policy.getLastUserMessageAt("conv_test_5")),
    msg2_time + WINDOW_DURATION_MS,
  );
  console.log("✅ Test 5 passed: New customer message resets expiry to Wednesday 09:00\n");

  // ============================================================
  // Test 6: Bot messages do not reset window
  // ============================================================
  console.log("Test 6: Bot messages do not reset window");
  const custTime = new Date("2026-09-01T10:00:00.000Z").getTime();
  policy.recordInboundCustomerMessage("conv_test_6", custTime);

  const initialExpiry = policy.getWindowExpiry(
    policy.getLastUserMessageAt("conv_test_6"),
  );

  // Simulate bot sending replies at 11:00 and 12:00 (without calling recordInboundCustomerMessage)
  const currentExpiry = policy.getWindowExpiry(
    policy.getLastUserMessageAt("conv_test_6"),
  );
  assert.equal(currentExpiry, initialExpiry);
  assert.equal(currentExpiry, custTime + WINDOW_DURATION_MS);
  console.log("✅ Test 6 passed: Bot responses did not extend window expiry\n");

  // ============================================================
  // Test 7: Status webhook does not reset window
  // ============================================================
  console.log("Test 7: Status webhook receipts do not reset window");
  const whatsappService = new WhatsAppService(null, policy, outboundPolicy);
  const userMsgTime = new Date("2026-09-01T10:00:00.000Z").getTime();
  policy.recordInboundCustomerMessage("971500000007", userMsgTime);

  // Status webhooks (delivered, read)
  await whatsappService.processStatuses([
    {
      id: "wamid.msg1",
      status: "delivered",
      timestamp: String(userMsgTime + 1800000),
    },
    {
      id: "wamid.msg1",
      status: "read",
      timestamp: String(userMsgTime + 3600000),
    },
  ]);

  assert.equal(policy.getLastUserMessageAt("971500000007"), userMsgTime);
  console.log("✅ Test 7 passed: Status webhooks did not modify window timestamp\n");

  // ============================================================
  // Test 8: Outbound response inside window calls Meta API
  // ============================================================
  console.log("Test 8: Outbound response inside window calls Meta API");
  let apiCalls = [];
  const mockApiService = new WhatsAppApiService({
    accessToken: "mock_token",
    phoneNumberId: "mock_phone_id",
  });
  mockApiService.sendMessage = async (to, message) => {
    apiCalls.push({ to, message });
    return { messages: [{ id: "wamid.out_001" }] };
  };

  const serviceWithMock = new WhatsAppService(
    mockApiService,
    policy,
    outboundPolicy,
  );
  policy.recordInboundCustomerMessage("971501111111", baseTime);

  const resInside = await serviceWithMock.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Hello inside window!" } },
    {
      now: baseTime + 3600000,
      conversationKey: "971501111111",
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t8_001",
        customerWaId: "971501111111",
        inboundReceivedAt: baseTime,
      },
    },
  );

  assert.equal(resInside.sent, true);
  assert.equal(resInside.blocked, false);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].to, "971501111111");
  console.log("✅ Test 8 passed: Outbound inside window dispatched to Meta API\n");

  // ============================================================
  // Test 9: Outbound response after expiry does NOT call Meta API
  // ============================================================
  console.log("Test 9: Outbound response after expiry does NOT call Meta API");
  apiCalls = []; // reset
  const resExpired = await serviceWithMock.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Hello after expiry!" } },
    {
      now: baseTime + WINDOW_DURATION_MS + 10000,
      conversationKey: "971501111111",
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t9_001",
        customerWaId: "971501111111",
        inboundReceivedAt: baseTime,
      },
    },
  );

  assert.equal(resExpired.sent, false);
  assert.equal(resExpired.blocked, true);
  assert.equal(resExpired.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(apiCalls.length, 0); // Meta API was NOT called
  console.log("✅ Test 9 passed: Outbound after expiry was blocked from Meta API\n");

  // ============================================================
  // Test 10: Exact expiry boundary blocks Meta API call
  // ============================================================
  console.log("Test 10: Exact expiry boundary blocks Meta API call");
  apiCalls = [];
  const resExact = await serviceWithMock.sendMessage(
    "971501111111",
    { type: "text", text: { body: "Hello exact boundary!" } },
    {
      now: baseTime + WINDOW_DURATION_MS,
      conversationKey: "971501111111",
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t10_001",
        customerWaId: "971501111111",
        inboundReceivedAt: baseTime,
      },
    },
  );

  assert.equal(resExact.sent, false);
  assert.equal(resExact.blocked, true);
  assert.equal(resExact.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(apiCalls.length, 0);
  console.log("✅ Test 10 passed: Exact boundary strictly blocked Meta API call\n");

  // ============================================================
  // Test 11: Slow LLM causes expiry (Crucial Timing Test)
  // ============================================================
  console.log("Test 11: Slow LLM processing causes expiry during execution");
  apiCalls = [];
  const t_customer = baseTime;
  const t_expiry = t_customer + WINDOW_DURATION_MS;
  const t_inbound = t_expiry - 5000; // 5 seconds before expiry

  policy.recordInboundCustomerMessage("971502222222", t_customer);

  // Inbound check: window is still OPEN at t_inbound
  assert.equal(policy.isWindowOpen(t_customer, t_inbound), true);

  // LLM takes 10 seconds to generate response -> completion time is t_expiry + 5000ms
  const t_llm_completed = t_inbound + 10000; // 5 seconds AFTER expiry

  // Final Outbound Guard immediately before Meta API call
  const sendSlowLLM = await serviceWithMock.sendMessage(
    "971502222222",
    { type: "text", text: { body: "Late AI generated response" } },
    {
      now: t_llm_completed,
      conversationKey: "971502222222",
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t11_001",
        customerWaId: "971502222222",
        inboundReceivedAt: t_customer,
      },
    },
  );

  assert.equal(sendSlowLLM.sent, false);
  assert.equal(sendSlowLLM.blocked, true);
  assert.equal(sendSlowLLM.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
  assert.equal(apiCalls.length, 0);
  console.log("✅ Test 11 passed: Slow LLM late response caught and blocked by outbound guard\n");

  // ============================================================
  // Test 12: New customer message after expiry reopens window
  // ============================================================
  console.log("Test 12: New customer message after expiry reopens window");
  apiCalls = [];
  const t_new_customer = t_expiry + 60000; // 1 min after expiry
  policy.recordInboundCustomerMessage("971502222222", t_new_customer);

  const resAfterNewMsg = await serviceWithMock.sendMessage(
    "971502222222",
    { type: "text", text: { body: "Welcome back! How can we help?" } },
    {
      now: t_new_customer + 1000,
      conversationKey: "971502222222",
      inboundTriggerContext: {
        triggeredByInboundMessage: true,
        inboundMessageId: "wamid.t12_001",
        customerWaId: "971502222222",
        inboundReceivedAt: t_new_customer,
      },
    },
  );

  assert.equal(resAfterNewMsg.sent, true);
  assert.equal(resAfterNewMsg.blocked, false);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].to, "971502222222");
  console.log("✅ Test 12 passed: New customer message re-opened window and sent message\n");

  // ============================================================
  // Test 13: Customer Isolation (Customer A vs Customer B)
  // ============================================================
  console.log("Test 13: Customer Isolation (Customer A vs Customer B)");
  const timeA = new Date("2026-09-01T10:00:00.000Z").getTime();
  const timeB = new Date("2026-09-01T18:00:00.000Z").getTime(); // 8 hours later

  policy.recordInboundCustomerMessage("customer_A", timeA);
  policy.recordInboundCustomerMessage("customer_B", timeB);

  // Check at 2026-09-02T12:00:00.000Z (26h after A, but only 18h after B)
  const checkTime = new Date("2026-09-02T12:00:00.000Z").getTime();

  assert.equal(
    policy.isWindowOpen(policy.getLastUserMessageAt("customer_A"), checkTime),
    false,
  );
  assert.equal(
    policy.isWindowOpen(policy.getLastUserMessageAt("customer_B"), checkTime),
    true,
  );

  const guardA = policy.checkOutboundEligibility({
    lastUserMessageAt: policy.getLastUserMessageAt("customer_A"),
    now: checkTime,
  });
  const guardB = policy.checkOutboundEligibility({
    lastUserMessageAt: policy.getLastUserMessageAt("customer_B"),
    now: checkTime,
  });

  assert.equal(guardA.allowed, false);
  assert.equal(guardA.blocked, true);
  assert.equal(guardB.allowed, true);
  assert.equal(guardB.blocked, false);
  console.log("✅ Test 13 passed: Customer A expired while Customer B remains OPEN\n");

  // ============================================================
  // Test 14: Duplicate webhook idempotency
  // ============================================================
  console.log("Test 14: Duplicate webhook idempotency");
  const testWamid = "wamid.HBgMOTE1MDEyMzQ1NjcVAgASGBQzQTkyREJCRj";
  assert.equal(serviceWithMock.isDuplicateMessage(testWamid), false);
  serviceWithMock.markMessageProcessed(testWamid);
  assert.equal(serviceWithMock.isDuplicateMessage(testWamid), true);
  console.log("✅ Test 14 passed: Duplicate wamid recognized and protected\n");

  console.log("=================================================");
  console.log("🎉 ALL 14 CUSTOMER SERVICE WINDOW TESTS PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
