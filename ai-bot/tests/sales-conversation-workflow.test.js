import assert from "node:assert/strict";
import SalesConversationService from "../modules/sales/services/SalesConversationService.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING PRODUCTION SALES CONVERSATION WORKFLOW");
  console.log("=================================================\n");

  const conversationService = new SalesConversationService();
  const responseAdapter = new WhatsAppResponseAdapter();
  const apiService = new WhatsAppApiService({
    accessToken: "mock_token",
    phoneNumberId: "mock_phone_id",
  });

  // ============================================================
  // Test 1: Sanitization & Defensive Fallbacks
  // ============================================================
  console.log("Test 1: Sanitization & Defensive Fallbacks");
  const sanitizedContext = conversationService.sanitizeContext(null);
  assert.equal(sanitizedContext.channel, "WHATSAPP");
  assert.equal(sanitizedContext.message, "");
  assert.deepEqual(sanitizedContext.catalog, {});

  const sanitizedDecision = conversationService.sanitizeDecision({
    type: "SELECT_PRODUCT",
    actions: [
      { id: "opt1", label: "Option 1", payload: { x: 1 } },
      null,
      { id: "opt2", title: "Option 2" },
      { id: null, label: "Invalid Option" },
    ],
    sections: [
      {
        id: "sec1",
        title: "Section 1",
        rows: [
          { id: "r1", title: "Row 1", description: "Desc 1" },
          { id: null, title: "Invalid Row" },
        ],
      },
    ],
  });

  assert.equal(sanitizedDecision.actions.length, 2);
  assert.equal(sanitizedDecision.actions[0].id, "opt1");
  assert.equal(sanitizedDecision.actions[0].label, "Option 1");
  assert.equal(sanitizedDecision.actions[1].label, "Option 2");
  assert.equal(sanitizedDecision.sections.length, 1);
  assert.equal(sanitizedDecision.sections[0].rows.length, 1);
  console.log("✅ Sanitization & Defensive Fallbacks passed\n");

  // ============================================================
  // Test 2: Interaction Type Deduction
  // ============================================================
  console.log("Test 2: Interaction Type Deduction");
  assert.equal(
    conversationService.getInteraction({ type: "COLLECT_CUSTOMER" }),
    "FORM"
  );
  assert.equal(
    conversationService.getInteraction({
      actions: [{ id: "a1", label: "A1" }, { id: "a2", label: "A2" }],
    }),
    "BUTTONS"
  );
  assert.equal(
    conversationService.getInteraction({
      actions: [
        { id: "a1", label: "A1" },
        { id: "a2", label: "A2" },
        { id: "a3", label: "A3" },
        { id: "a4", label: "A4" },
      ],
    }),
    "LIST"
  );
  assert.equal(
    conversationService.getInteraction({
      sections: [{ id: "s1", rows: [{ id: "r1", title: "R1" }] }],
    }),
    "LIST"
  );
  assert.equal(conversationService.getInteraction({}), "MESSAGE");
  console.log("✅ Interaction Type Deduction passed\n");

  // ============================================================
  // Test 3: Deterministic Message Phrasing for All Decision Types
  // ============================================================
  console.log("Test 3: Deterministic Message Phrasing for All Decision Types");
  const testTypes = [
    { type: "START_ORDER", match: "Welcome to Deluxe Printing" },
    { type: "SELECT_PRODUCT", match: "Please choose a product" },
    { type: "BROWSE_PRODUCTS", match: "Browse our catalog categories" },
    { type: "UNKNOWN_PRODUCT", match: "I couldn't find an exact match" },
    { type: "SELECT_SELECTION", match: "Please select the style/category" },
    { type: "SELECT_NESTED_PRODUCT", match: "Please choose the specific option" },
    { type: "ORDER_FORM", match: "Please provide the specifications" },
    { type: "REVIEW_ORDER", match: "Please review your order summary" },
    { type: "CONFIRM_ORDER", match: "Your order has been confirmed" },
    { type: "CANCEL_ORDER", match: "Your order has been cancelled" },
    { type: "COLLECT_CUSTOMER", match: "Please provide your contact details" },
    { type: "ORDER_COMPLETED", match: "Thank you for choosing Deluxe Printing" },
  ];

  for (const { type, match } of testTypes) {
    const msg = conversationService.buildDeterministicMessage(
      { order: { items: [{ product: { name: "Business Cards" } }] } },
      { type, context: { product: { name: "Business Cards" } } }
    );
    assert(
      msg.includes(match),
      `Expected message for ${type} to contain "${match}", but got: "${msg}"`
    );
  }
  console.log("✅ Deterministic Message Phrasing passed\n");

  // ============================================================
  // Test 4: End-to-End Sales Conversation to Meta API Outbound Payloads
  // ============================================================
  console.log("Test 4: End-to-End Sales Conversation to Meta Outbound Payloads");
  const salesBrain = new SalesBrain();

  // 4.1 Discovery: "I need business cards"
  const step1 = await salesBrain.execute({
    userMessage: "I need business cards",
    channel: "WHATSAPP",
  });
  const conv1 = await conversationService.generate(
    { message: "I need business cards" },
    step1
  );
  const wa1 = responseAdapter.adapt(conv1);
  assert(wa1.length > 0);
  assert.equal(wa1[0].type, "interactive");

  // 4.2 Product Selected -> Selection options
  const step2 = await salesBrain.execute({
    channel: "WHATSAPP",
    liveRequirement: step1.liveRequirement,
    action: { id: "SELECT_PRODUCT", payload: { productId: "business-cards" } },
  });
  const conv2 = await conversationService.generate({}, step2);
  const wa2 = responseAdapter.adapt(conv2);
  assert(wa2.length > 0);
  assert.equal(wa2[0].type, "interactive");

  // 4.3 Outbound Meta API format check
  let intercepted = null;
  apiService.sendMessage = async (to, payload) => {
    intercepted = { to, payload };
    return { messages: [{ id: "wamid.out_test_123" }] };
  };

  await apiService.sendTextMessage("971501234567", conv2.message);
  assert.equal(intercepted.to, "971501234567");
  assert.equal(intercepted.payload.text.body, conv2.message);

  await apiService.sendButtonMessage(
    "971501234567",
    "Choose category:",
    step2.actions.slice(0, 3)
  );
  assert.equal(intercepted.payload.interactive.type, "button");
  assert(intercepted.payload.interactive.action.buttons.length <= 3);

  console.log("✅ End-to-End Sales Conversation & Meta Payloads passed\n");

  console.log("=================================================");
  console.log("🎉 ALL SALES CONVERSATION WORKFLOW TESTS PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
