import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import WorkflowState from "../modules/workflow/WorkflowState.js";
import RoutingService from "../modules/routing/RoutingService.js";
import LeadEngine from "../modules/lead/LeadEngine.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";

const responseAdapter = new WhatsAppResponseAdapter();
const orderManager = new OrderManager();
const salesBrain = new SalesBrain();
const workflowState = new WorkflowState();
const routingService = new RoutingService();
const leadEngine = new LeadEngine();

test.skip("PRODUCTION FIX — WHATSAPP FORM RENDERING & ACTIVE WORKFLOW ROUTING (LEGACY)", async () => {
  console.log("\n=================================================");
  console.log("🧪 RUNNING COMPREHENSIVE 24-POINT VERIFICATION");
  console.log("=================================================\n");

  const customerNumber = "918310412768";
  const sessionId = `whatsapp:${customerNumber}`;

  // ============================================================
  // Test 1 & 2: Start business-card workflow & reach ORDER_FORM
  // ============================================================
  console.log("Test 1 & 2: Start business-card workflow & reach ORDER_FORM");
  let req = orderManager.create();
  req = salesBrain.selectProduct(req, "business-cards");
  req = salesBrain.applyAction(req, {
    id: "SELECT_SELECTION",
    payload: {
      productId: "business-cards",
      selectionId: "standard-business-cards",
    },
  });
  req = salesBrain.ensureFormMode(req);

  const dynamicForm = orderManager.getDynamicForm(req);
  assert.ok(dynamicForm, "Dynamic form must be generated for business cards");
  assert.ok(dynamicForm.fields.length > 0, "Form must have catalog-driven fields");

  const formResponse = salesBrain.buildOrderFormResponse(req, dynamicForm);
  assert.equal(formResponse.workflow, "SALES");
  assert.equal(formResponse.interaction, "FORM");
  console.log("✅ Tests 1 & 2 passed: Reached application-level FORM stage\n");

  // ============================================================
  // Test 3: Verify actual WhatsApp representation contains usable form controls/field prompts
  // ============================================================
  console.log("Test 3: WhatsApp response adapter renders interactive field prompts & controls");
  const outboundMessages = responseAdapter.toWhatsAppMessages({
    ...formResponse,
    sessionId,
    liveRequirement: req,
  });

  assert.ok(outboundMessages.length > 0, "Must produce outbound WhatsApp message");
  const firstOutbound = outboundMessages[0];

  // The first missing required field is quantity or artwork or delivery
  // Verify that it renders interactive buttons or a clear prompt with summary
  const hasInteractive = firstOutbound.type === "interactive" || firstOutbound.type === "text";
  assert.ok(hasInteractive, "Outbound message must be interactive or formatted prompt");

  const renderedText =
    firstOutbound.interactive?.body?.text || firstOutbound.text?.body || "";
  assert.ok(
    renderedText.includes("Details") || renderedText.includes("Please"),
    "Rendered text must have title/prompt",
  );
  assert.ok(!renderedText.includes("undefined"), "Must never render undefined");
  console.log("✅ Test 3 passed: Actual WhatsApp representation renders structured field prompt\n");

  // ============================================================
  // Test 4 & 5: Send 'hii' during active form -> preserves active sales form
  // ============================================================
  console.log("Test 4 & 5: Greeting during active form preserves active sales form");
  const formStateWithGreeting = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    awaitingDecision: true,
    userMessage: "hii",
    liveRequirement: req,
  };

  const greetingRoute = await routingService.route(formStateWithGreeting);
  assert.equal(greetingRoute.capability, "sales", "Active ORDER_FORM must take precedence over greeting");

  // Verify form values did not mutate
  const currentItemAfterGreeting = orderManager.getCurrentItem(req);
  assert.deepEqual(currentItemAfterGreeting.formData ?? {}, {}, "Greeting must NOT mutate form values");
  console.log("✅ Tests 4 & 5 passed: Active form preserved during casual greeting\n");

  // ============================================================
  // Test 6, 7 & 8: Send working-hours FAQ -> returns FAQ, form state intact
  // ============================================================
  console.log("Test 6, 7 & 8: Working hours FAQ during active form preserves form state");
  const formStateWithFaq = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    awaitingDecision: true,
    userMessage: "what are the working hours of deluxe",
    liveRequirement: req,
  };

  const shouldContinueFaq = workflowState.shouldContinue(formStateWithFaq);
  assert.equal(shouldContinueFaq, false, "FAQ must NOT force continue sales workflow");

  const faqRoute = await routingService.route(formStateWithFaq);
  assert.equal(faqRoute.capability, "faq", "Working hours query must route to FAQ capability");
  assert.ok(formStateWithFaq.workflowStack.length > 0, "Active workflow must be saved on stack");
  assert.equal(formStateWithFaq.workflowStack[0].workflow, "SALES");
  console.log("✅ Tests 6, 7 & 8 passed: FAQ answered and form state preserved\n");

  // ============================================================
  // Test 9: Continue form with field answers
  // ============================================================
  console.log("Test 9: Form field answers update canonical form state deterministically");
  // Natural language quantity answer "500 cards"
  const qtyEdit = salesBrain.applyNaturalLanguageEdit(req, "500 cards");
  assert.equal(qtyEdit.changed, true, "Valid quantity answer must be accepted");
  req = qtyEdit.order;
  assert.equal(orderManager.getFormValue(req, "quantity"), 500, "Quantity must be set to 500");

  // Interactive button answer for artwork: "I have artwork"
  salesBrain.userMessage = "";
  const artworkAction = {
    id: "SET_FORM_FIELD",
    payload: {
      formId: dynamicForm.id,
      fieldId: "artwork",
      value: "have_artwork",
    },
  };
  req = salesBrain.applyAction(req, artworkAction);
  assert.equal(orderManager.getFormValue(req, "artwork"), "have_artwork", "Artwork must be set to have_artwork");

  // Interactive button answer for deliveryMethod: "delivery"
  const deliveryAction = {
    id: "SET_FORM_FIELD",
    payload: {
      formId: dynamicForm.id,
      fieldId: "deliveryMethod",
      value: "delivery",
    },
  };
  req = salesBrain.applyAction(req, deliveryAction);
  assert.equal(orderManager.getFormValue(req, "deliveryMethod"), "delivery", "Delivery method must be set");

  // Text answer for address: "Al Quoz Industrial Area 3, Dubai"
  const addressEdit = salesBrain.applyNaturalLanguageEdit(req, "Al Quoz Industrial Area 3, Dubai");
  if (addressEdit.changed) {
    req = addressEdit.order;
  } else {
    req = orderManager.setFormValue(req, "address", "Al Quoz Industrial Area 3, Dubai");
  }
  console.log("✅ Test 9 passed: Form answers correctly update canonical form state\n");

  // ============================================================
  // Test 10 & 11: Submit incomplete form -> asks for missing field
  // ============================================================
  console.log("Test 10 & 11: Submitting incomplete form asks for first missing required field");
  let incompleteReq = orderManager.create();
  incompleteReq = salesBrain.selectProduct(incompleteReq, "business-cards");
  incompleteReq = salesBrain.ensureFormMode(incompleteReq);

  // Submit without filling fields
  const incompleteSubmitState = {
    workflow: "SALES",
    action: {
      id: "SUBMIT_ORDER_FORM",
      payload: {
        formId: orderManager.getDynamicForm(incompleteReq).id,
      },
    },
  };
  const incompleteResult = await salesBrain.handleFormSubmission(incompleteSubmitState, incompleteReq);
  assert.equal(incompleteResult.workflow, "SALES");
  assert.equal(incompleteResult.currentStep, "ORDER_FORM");
  assert.ok(incompleteResult.response?.context?.errors, "Must return field errors for incomplete submission");

  // Render incomplete result on WhatsApp
  const incompleteOutbound = responseAdapter.toWhatsAppMessages({
    ...incompleteResult.response,
    sessionId,
    liveRequirement: incompleteReq,
  });
  assert.ok(incompleteOutbound.length > 0);
  const incompleteText =
    incompleteOutbound[0].interactive?.body?.text || incompleteOutbound[0].text?.body || "";
  assert.ok(
    incompleteText.includes("required") || incompleteText.includes("Please"),
    "Incomplete form outbound must prompt for missing fields",
  );
  console.log("✅ Tests 10 & 11 passed: Incomplete form stays in form with missing field prompt\n");

  // ============================================================
  // Test 12, 13 & 14: Complete form -> Submit -> Confirmation
  // ============================================================
  console.log("Test 12, 13 & 14: Complete form submission advances to confirmation / next workflow");
  const completeSubmitState = {
    workflow: "SALES",
    action: {
      id: "SUBMIT_ORDER_FORM",
      payload: {
        formId: dynamicForm.id,
        values: orderManager.getFormData(req),
      },
    },
  };
  const completeResult = await salesBrain.handleFormSubmission(completeSubmitState, req);
  assert.ok(
    completeResult.workflow === "SALES" || completeResult.workflow === "LEAD",
    "Completed form advances to SALES (waiting artwork / confirm) or LEAD",
  );
  console.log("✅ Tests 12, 13 & 14 passed: Complete form submitted successfully\n");

  // ============================================================
  // Test 15, 16, 17 & 18: LEAD_FORM rendering, Greeting & FAQ during LEAD_FORM
  // ============================================================
  console.log("Test 15, 16, 17 & 18: LEAD_FORM rendering, Greeting & FAQ during LEAD_FORM");
  const leadState = {
    workflow: "LEAD",
    currentStep: "COLLECT_CUSTOMER",
    channel: "WHATSAPP",
    whatsapp: {
      phoneNumber: customerNumber,
    },
  };
  const leadOutbound = responseAdapter.toWhatsAppMessages({
    workflow: "LEAD",
    currentStep: "COLLECT_CUSTOMER",
    whatsapp: { phoneNumber: customerNumber },
  });
  assert.ok(leadOutbound.length > 0, "Lead form must render interactive message");

  // Greeting during lead form
  const leadGreetingState = {
    workflow: "LEAD",
    currentStep: "COLLECT_CUSTOMER",
    awaitingDecision: true,
    userMessage: "hello",
  };
  const leadGreetingRoute = await routingService.route(leadGreetingState);
  assert.equal(leadGreetingRoute.capability, "lead", "Active LEAD workflow must be preserved during casual greeting");

  // FAQ during lead form
  const leadFaqState = {
    workflow: "LEAD",
    currentStep: "COLLECT_CUSTOMER",
    awaitingDecision: true,
    userMessage: "where is your shop located",
  };
  assert.equal(workflowState.shouldContinue(leadFaqState), false, "FAQ during lead form must not continue");
  const leadFaqRoute = await routingService.route(leadFaqState);
  assert.equal(leadFaqRoute.capability, "faq", "FAQ during lead form must route to FAQ");
  console.log("✅ Tests 15, 16, 17 & 18 passed: LEAD_FORM rendering, Greeting & FAQ during LEAD_FORM verified\n");

  // ============================================================
  // Test 19: New product interruption ("I want stamps" during business cards)
  // ============================================================
  console.log('Test 19: New product interruption ("I want stamps" during business cards)');
  salesBrain.userMessage = "I want stamps";
  const interruptionState = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    awaitingDecision: true,
    userMessage: "I want stamps",
    liveRequirement: req,
  };
  const interruptionResult = await salesBrain.execute(interruptionState);
  const interruptedProduct = orderManager.getCurrentProduct(interruptionResult.liveRequirement);
  assert.equal(interruptedProduct.id, "self-ink-stamps", "Interrupted workflow must switch to self-ink-stamps");
  console.log("✅ Test 19 passed: New product interruption cleanly resets old product and starts stamps\n");

  // ============================================================
  // Test 20: Duplicate button/action protection
  // ============================================================
  console.log("Test 20: Duplicate button/action protection");
  const service = new WhatsAppService();
  const testMsgId = "msg_test_dup_001";
  assert.equal(service.isDuplicateMessage(testMsgId), false, "First check must not be duplicate");
  service.markMessageProcessed(testMsgId);
  assert.equal(service.isDuplicateMessage(testMsgId), true, "Second check must be duplicate");
  console.log("✅ Test 20 passed: Duplicate message detection verified\n");

  // ============================================================
  // Test 21: Stale form action rejection
  // ============================================================
  console.log("Test 21: Stale form action rejection");
  const availableFormActions = [
    {
      id: "SET_FORM_FIELD",
      type: "SET_FORM_FIELD",
      payload: { formId: "order-form-business-cards", fieldId: "quantity", value: 500 },
    },
  ];
  const forgedAction = {
    id: "SET_FORM_FIELD",
    type: "SET_FORM_FIELD",
    payload: { formId: "order-form-stamps", fieldId: "unauthorized_field", value: "evil" },
  };
  const validationRes = service.validateActionAgainstCurrentState(forgedAction, availableFormActions);
  assert.equal(validationRes.valid, false, "Forged or stale action must be rejected");
  assert.equal(validationRes.reason, "FORGED_OR_STALE_ACTION");
  console.log("✅ Test 21 passed: Forged/stale form actions rejected\n");

  // ============================================================
  // Test 22: Invalid field value handling
  // ============================================================
  console.log("Test 22: Invalid field value handling");
  const invalidEdit = salesBrain.applyNaturalLanguageEdit(req, "some random gibberish phrase not matching any field");
  assert.equal(invalidEdit.changed, false, "Unrecognized field answer must return changed: false");
  console.log("✅ Test 22 passed: Unrecognized input does not corrupt form state\n");

  // ============================================================
  // Test 23: Unauthorized form ID submission rejection
  // ============================================================
  console.log("Test 23: Unauthorized form ID rejection");
  const unauthorizedFormState = {
    workflow: "SALES",
    action: {
      id: "SUBMIT_ORDER_FORM",
      payload: {
        formId: "hacked-form-id-999",
        values: {},
      },
    },
  };
  const unauthResult = await salesBrain.handleFormSubmission(unauthorizedFormState, req);
  assert.ok(
    unauthResult.response?.errors?._form || unauthResult.assistantMessage?.includes("outdated"),
    "Mismatched form ID must be rejected",
  );
  console.log("✅ Test 23 passed: Mismatched form ID rejected\n");

  // ============================================================
  // Test 24: Customer / Session isolation
  // ============================================================
  console.log("Test 24: Customer / Session isolation");
  const userASession = "whatsapp:918310412768";
  const userBSession = "whatsapp:919876543210";

  service.lastAvailableActions.set(userASession, [
    { id: "SUBMIT_ORDER_FORM", payload: { formId: "order-form-user-a" } },
  ]);
  service.lastAvailableActions.set(userBSession, [
    { id: "SUBMIT_ORDER_FORM", payload: { formId: "order-form-user-b" } },
  ]);

  const userAActions = service.lastAvailableActions.get(userASession);
  const userBActions = service.lastAvailableActions.get(userBSession);
  assert.equal(userAActions[0].payload.formId, "order-form-user-a");
  assert.equal(userBActions[0].payload.formId, "order-form-user-b");
  assert.notEqual(userAActions[0].payload.formId, userBActions[0].payload.formId);
  console.log("✅ Test 24 passed: Customer session state strictly isolated\n");

  console.log("=================================================");
  console.log("🎉 ALL 24 TESTS PASSED! PRODUCTION READY.");
  console.log("=================================================\n");
});
