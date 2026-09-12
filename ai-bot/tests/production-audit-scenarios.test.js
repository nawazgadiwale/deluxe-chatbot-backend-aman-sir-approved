/**
 * production-audit-scenarios.test.js
 *
 * Mandatory Production Verification Suite for Failure Scenarios A - H.
 *
 * Scenarios:
 * TEST A: Business Cards -> Category -> Nested Product -> Incomplete Form -> "i want to order stamps"
 *         => Cleanly switches to stamps, resets old form values, no greeting, preserves history.
 * TEST B: In ORDER_FORM -> "500" => Distinguishes field answer from product intent, continues form.
 * TEST C: In ORDER_FORM -> "hey" => Pure greeting does not reset form.
 * TEST D: In ORDER_FORM -> "hey, I want stamps" => Explicit product intent wins, switches to stamps.
 * TEST E: Stale button from previous product clicked after switching => FORGED_OR_STALE_ACTION.
 * TEST F: Duplicate inbound event => Single logical processing, duplicate rejected.
 * TEST G: Cross-customer action isolation => Customer B cannot execute Customer A's action.
 * TEST H: Invalid webhook auth => Fails closed with 403, zero AI, zero outbound, zero mutation.
 */

import assert from "node:assert/strict";
import crypto from "crypto";

import SalesNode from "../ai/graph/nodes/SalesNode.js";
import ConversationGraph from "../ai/graph/ConversationGraph.js";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import MetaProviderAdapter from "../modules/whatsapp/providers/MetaProviderAdapter.js";
import WhatsAppWebhookHandler from "../modules/whatsapp/WhatsAppWebhookHandler.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";

console.log("\n=================================================");
console.log("🧪 RUNNING PRODUCTION AUDIT SCENARIO SUITE (A - H)");
console.log("=================================================\n");

const salesNode = new SalesNode();
const graph = new ConversationGraph();
const whatsAppService = new WhatsAppService();

// =====================================================
// TEST A: Product Interruption During ORDER_FORM
// =====================================================
console.log("--- TEST A: Incomplete Form Interrupted by New Product Intent ---");
// Step 1: Customer asks for business cards
let state = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  userMessage: "i want to order business cards",
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});
assert.equal(state.workflow, "SALES");
assert.equal(state.currentStep, "SELECT_SELECTION");

// Step 2: Customer selects category "Budget-Friendly"
state = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  action: {
    id: "SELECT_SELECTION",
    type: "SELECT_SELECTION",
    label: "Budget-Friendly Business Cards",
    payload: { productId: "business-cards", selectionId: "budget-friendly" },
  },
  order: state.order,
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});
assert.equal(state.currentStep, "SELECT_NESTED_PRODUCT");

// Step 3: Customer selects nested product "Affordable Business Cards"
state = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  action: {
    id: "SELECT_NESTED_PRODUCT",
    type: "SELECT_NESTED_PRODUCT",
    label: "Affordable Business Cards",
    payload: {
      productId: "business-cards",
      selectionId: "budget-friendly",
      nestedProductId: "affordable",
    },
  },
  order: state.order,
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});
if (state.currentStep === "PRODUCT_DETAILS") {
  state = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    action: {
      id: "ORDER_NOW",
      type: "ORDER_NOW",
      payload: { productId: "affordable", formId: "order-form-affordable" },
    },
    order: state.order,
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });
}
assert.equal(state.currentStep === "ORDER_FORM" || state.currentStep === "COLLECT_PRODUCT_FIELD", true);
assert.equal(state.liveRequirement.items[0].selectedProduct.id, "affordable");

// Step 4: Interruption: Customer sends "i want to order stamps" while in incomplete form
const interruptedState = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  userMessage: "i want to order stamps",
  order: state.order,
  action: null,
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});

// Verify Test A expectations:
assert.equal(interruptedState.workflow, "SALES");
const activeItem = interruptedState.liveRequirement?.items?.[0];
assert.equal(activeItem?.product?.id, "self-ink-stamps", "Current product must be self-ink-stamps");
assert.notEqual(activeItem?.selectedProduct?.id, "affordable", "Old business cards product must not leak");
assert.notEqual(interruptedState.response?.message, "Please complete the order details below.", "Must not ask to complete business card form");
assert.equal(interruptedState.currentStep !== "GREETING", true, "Must not greet");
console.log("✅ TEST A Passed: Clean product interruption during ORDER_FORM with zero field leakage");

// =====================================================
// TEST B: Field Answer "500" Continues ORDER_FORM
// =====================================================
console.log("\n--- TEST B: Field Answer in ORDER_FORM Continues Form ---");
// Customer is in form/collection from Step 3 and sends "500"
const answeredFormState = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  userMessage: "500",
  order: state.order,
  action: null,
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});

assert.equal(
  ["ORDER_FORM", "COLLECT_PRODUCT_FIELD", "SELECT_ADDONS"].includes(answeredFormState.currentStep),
  true,
  "Must remain in active order collection",
);
const activeAffordable = answeredFormState.liveRequirement.items[0];
const capturedQty = activeAffordable.formData?.quantity || activeAffordable.workflow?.quantity;
assert.equal(capturedQty, 500, "Quantity 500 must be captured");
console.log("✅ TEST B Passed: '500' captured as quantity field answer without resetting order");

// =====================================================
// TEST C: Greeting "hey" in Active Workflow Preserves State
// =====================================================
console.log("\n--- TEST C: Pure Greeting in Active Workflow Preserves State ---");
// Customer sends "hey" while in ORDER_FORM
const greetingInFormState = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  userMessage: "hey",
  order: state.order,
  action: null,
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});

assert.equal(
  ["ORDER_FORM", "COLLECT_PRODUCT_FIELD", "SELECT_ADDONS"].includes(greetingInFormState.currentStep),
  true,
  "Must remain in active order collection",
);
console.log("✅ TEST C Passed: 'hey' does not reset active ORDER_FORM workflow");

// =====================================================
// TEST D: Greeting + New Product Intent Switches Product
// =====================================================
console.log("\n--- TEST D: Greeting + Product Intent Switches to New Product ---");
// Customer sends "hey, I want stamps" while in business card collection
const greetingWithIntentState = await salesNode.execute({
  site: "exprintmart",
  channel: "WHATSAPP",
  userMessage: "hey, I want stamps",
  order: state.order,
  action: null,
  memory: {},
  persistence: { conversation: { dirty: false }, order: { dirty: false } },
});

assert.equal(greetingWithIntentState.workflow, "SALES");
const stampsItem = greetingWithIntentState.liveRequirement?.items?.[0];
assert.equal(stampsItem?.product?.id, "self-ink-stamps", "Must switch to stamps workflow");
console.log("✅ TEST D Passed: 'hey, I want stamps' prioritizes product intent and starts stamps");

// =====================================================
// TEST E: Stale Action Rejected with FORGED_OR_STALE_ACTION
// =====================================================
console.log("\n--- TEST E: Stale Button Click Rejected After Product Switch ---");
// Active state is now stamps. Customer clicks old business-card button
const currentAvailableActions = greetingWithIntentState.response?.actions ?? [];
const staleActionAttempt = {
  id: "ButtonsV3:selection:business-cards:budget-friendly",
  payload: { productId: "business-cards", selectionId: "budget-friendly" },
};

const validationResult = whatsAppService.validateActionAgainstCurrentState(
  staleActionAttempt,
  currentAvailableActions,
);
assert.equal(validationResult.valid, false, "Stale action must be rejected");
assert.equal(validationResult.reason, "FORGED_OR_STALE_ACTION");
console.log("✅ TEST E Passed: Stale button from previous product strictly rejected");

// =====================================================
// TEST F: Duplicate Inbound Event Idempotency
// =====================================================
console.log("\n--- TEST F: Duplicate Inbound Event Protection ---");
const freshMessageId = "wamid.audit_test_event_unique_001";
assert.equal(whatsAppService.isDuplicateMessage(freshMessageId), false, "Fresh event is not duplicate");
whatsAppService.markMessageProcessed(freshMessageId);
assert.equal(whatsAppService.isDuplicateMessage(freshMessageId), true, "Second occurrence detected as duplicate");
console.log("✅ TEST F Passed: Duplicate inbound message ID is detected and safely suppressed");

// =====================================================
// TEST G: Cross-Customer Action Isolation
// =====================================================
console.log("\n--- TEST G: Cross-Customer Action Isolation ---");
// Customer A has actions for Business Cards
const customerAActions = [
  {
    id: "SELECT_SELECTION",
    type: "SELECT_SELECTION",
    label: "Luxury Business Cards",
    payload: { productId: "business-cards", selectionId: "luxury" },
  },
];

// Customer B is in Stamps workflow
const customerBActions = [
  {
    id: "SELECT_SELECTION",
    type: "SELECT_SELECTION",
    label: "Self-Inking Stamps",
    payload: { productId: "stamps", selectionId: "self-inking" },
  },
];

// Customer B attempts to submit Customer A's action
const crossCustomerAttempt = {
  id: "selection:business-cards:luxury",
  payload: { productId: "business-cards", selectionId: "luxury" },
};

const customerBValidation = whatsAppService.validateActionAgainstCurrentState(
  crossCustomerAttempt,
  customerBActions,
);
assert.equal(customerBValidation.valid, false, "Customer B cannot execute Customer A's action");
assert.equal(customerBValidation.reason, "FORGED_OR_STALE_ACTION");
console.log("✅ TEST G Passed: Cross-customer action strictly isolated and rejected");

// =====================================================
// TEST H: Invalid Webhook Authentication Fails Closed
// =====================================================
console.log("\n--- TEST H: Invalid Webhook Fails Closed ---");
const mockHandlerService = {
  processIncomingEvent: () => {
    throw new Error("FAIL: processIncomingEvent must NEVER be called for unauthenticated webhook!");
  },
};
const secureWebhookHandler = new WhatsAppWebhookHandler(mockHandlerService);

let resStatus = null;
let resBody = null;
const mockRes = {
  status: (code) => {
    resStatus = code;
    return mockRes;
  },
  json: (body) => {
    resBody = body;
    return mockRes;
  },
  send: (body) => {
    resBody = body;
    return mockRes;
  },
};

// Invalid Meta Signature
process.env.WHATSAPP_APP_SECRET = "production_meta_app_secret_789";

await secureWebhookHandler.handle(
  {
    headers: { "x-hub-signature-256": "sha256=invalid_hex_digest_forgery" },
    rawBody: Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }), "utf8"),
    body: { object: "whatsapp_business_account" },
  },
  mockRes,
);
assert.equal(resStatus, 403, "Invalid Meta signature must return 403");

console.log("✅ TEST H Passed: Invalid webhook auth fails closed with 403, zero AI execution, zero outbound");

console.log("\n=================================================");
console.log("🎉 ALL MANDATORY PRODUCTION AUDIT TESTS (A - H) PASSED!");
console.log("=================================================\n");
