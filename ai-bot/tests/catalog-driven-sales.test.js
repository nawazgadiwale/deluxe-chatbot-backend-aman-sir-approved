import test from "node:test";
import assert from "node:assert/strict";

import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import ConversationDecisionService from "../modules/sales/services/ConversationDecisionService.js";
import DecisionTypes from "../modules/sales/helpers/DecisionTypes.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";

const salesBrain = new SalesBrain();
const catalogService = new SalesCatalogService();
const decisionService = new ConversationDecisionService();
const responseAdapter = new WhatsAppResponseAdapter();

test("100% CATALOG-DRIVEN SALES WORKFLOW SUITE", async (suite) => {
  // ============================================================
  // Test A: Business Cards Flow
  // ============================================================
  await suite.test("A. Business Cards flow: selection -> quantity -> names -> material -> lamination -> deliveryMethod -> requirements -> addons -> confirmation -> order", async () => {
    // 1. Discovery / Product Selection
    let state = {
      action: { id: "SELECT_PRODUCT", payload: { productId: "business-cards" } },
    };
    let res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);

    // 2. Select category "budget-friendly"
    state = {
      ...res,
      action: {
        id: "SELECT_SELECTION",
        payload: { productId: "business-cards", selectionId: "budget-friendly" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "SELECT_NESTED_PRODUCT");

    // 3. Select nested product "affordable"
    state = {
      ...res,
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: { productId: "business-cards", selectionId: "budget-friendly", nestedProductId: "affordable" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "PRODUCT_DETAILS");

    // 4. Click ORDER_NOW
    state = {
      ...res,
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    res = await salesBrain.execute(state);

    // Step 1 of fields: quantity
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "quantity");
    // Verify delivery has NOT appeared yet
    assert.notEqual(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Step 2 of fields: quantity -> numberOfNames
    state = {
      ...res,
      action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 500 } },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "numberOfNames");
    assert.notEqual(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Step 3 of fields: numberOfNames -> material
    state = {
      ...res,
      action: { id: "SET_FIELD", payload: { fieldId: "numberOfNames", value: 2 } },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "material");
    assert.notEqual(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Step 4 of fields: material -> lamination
    state = {
      ...res,
      action: { id: "SET_FIELD", payload: { fieldId: "material", value: "350gsm Art Matt" } },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "lamination");
    assert.notEqual(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Step 5 of fields: lamination -> deliveryMethod
    state = {
      ...res,
      action: { id: "SET_FIELD", payload: { fieldId: "lamination", value: "matt" } },
    };
    res = await salesBrain.execute(state);

    // Delivery method step ONLY appears now
    assert.equal(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Choose delivery method: pickup
    state = {
      ...res,
      action: { id: "SET_DELIVERY", payload: { method: "pickup" } },
    };
    res = await salesBrain.execute(state);

    // Next workflow step: requirements (designRequired)
    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
    assert.equal(res.response.context.requirement.id, "designRequired");

    // Answer requirement
    state = {
      ...res,
      action: { id: "SET_REQUIREMENT", payload: { requirementId: "designRequired", value: "have_artwork" } },
    };
    res = await salesBrain.execute(state);

    // Next workflow step: addons (finishing options)
    assert.equal(res.currentStep, DecisionTypes.SELECT_ADDONS);

    // Complete addons step
    state = {
      ...res,
      action: { id: "NEXT_STEP", payload: { step: "addons" } },
    };
    res = await salesBrain.execute(state);

    // Next workflow step: confirmation (review order)
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);
    assert.ok(res.response.context.summary.includes("Order Summary"));

    // Confirm order
    state = {
      ...res,
      customer: { name: "John Doe", email: "john@example.com", company: "Acme" },
      action: { id: "CONFIRM_ORDER" },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.ORDER_COMPLETED);
    assert.equal(res.completed, true);
  });

  // ============================================================
  // Test B: Customer Clicks Delivery
  // ============================================================
  await suite.test("B. Customer clicks Delivery: SET_DELIVERY(delivery) -> delivery.method = 'delivery' -> address step appears only if required", async () => {
    // Start order at delivery method step
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);

    // Fill preceding fields
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 500 } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "numberOfNames", value: 1 } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "material", value: "350gsm Art Matt" } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "lamination", value: "none" } } });
    assert.equal(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Click Delivery
    state = {
      ...res,
      action: { id: "SET_DELIVERY", payload: { method: "delivery" } },
    };
    res = await salesBrain.execute(state);

    // delivery.method must be "delivery"
    const item = res.liveRequirement.items[0];
    assert.equal(item.delivery.method, "delivery");
    assert.equal(res.liveRequirement.delivery.method, "delivery");

    // Address step appears because address is not yet collected
    assert.equal(res.currentStep, DecisionTypes.DELIVERY_ADDRESS);

    // Send address
    state = {
      ...res,
      action: null,
      message: "Office 402, Business Bay, Dubai",
    };
    res = await salesBrain.execute(state);
    assert.equal(res.liveRequirement.items[0].delivery.address, "Office 402, Business Bay, Dubai");

    // Now moves to next step (designRequired requirement)
    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
  });

  // ============================================================
  // Test C: Customer Clicks Pickup
  // ============================================================
  await suite.test("C. Customer clicks Pickup: SET_DELIVERY(pickup) -> delivery.method = 'pickup' -> immediately resolves next step", async () => {
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 500 } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "numberOfNames", value: 1 } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "material", value: "350gsm Art Matt" } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "lamination", value: "none" } } });
    assert.equal(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Click Pickup
    state = {
      ...res,
      action: { id: "SET_DELIVERY", payload: { method: "pickup" } },
    };
    res = await salesBrain.execute(state);

    // delivery.method is pickup, and immediately resolves to requirements (NO address step)
    assert.equal(res.liveRequirement.items[0].delivery.method, "pickup");
    assert.notEqual(res.currentStep, DecisionTypes.DELIVERY_ADDRESS);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
  });

  // ============================================================
  // Test D: No Default Pickup
  // ============================================================
  await suite.test("D. No default pickup: before customer chooses delivery, delivery.method === null", async () => {
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);
    const item = res.liveRequirement.items[0];

    // Must be null/undefined, NEVER defaulted to pickup
    assert.equal(item.delivery?.method ?? null, null);
    assert.equal(res.liveRequirement.delivery?.method ?? null, null);

    // Advance through fields before delivery
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 200 } } });
    assert.equal(res.liveRequirement.items[0].delivery?.method ?? null, null);

    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "numberOfNames", value: 1 } } });
    assert.equal(res.liveRequirement.items[0].delivery?.method ?? null, null);

    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "material", value: "350gsm Art Matt" } } });
    assert.equal(res.liveRequirement.items[0].delivery?.method ?? null, null);

    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "lamination", value: "none" } } });
    assert.equal(res.liveRequirement.items[0].delivery?.method ?? null, null);
    assert.equal(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);
  });

  // ============================================================
  // Test E: Roll-Up Banner Flow (Quotation, Production, Dispatch)
  // ============================================================
  await suite.test("E. Roll-Up Banner flow: selection -> requirement -> quotation -> artwork -> delivery -> confirmation -> production -> dispatch", async () => {
    // 1. Selection
    let state = {
      action: { id: "SELECT_PRODUCT", payload: { productId: "roll-up-banner" } },
    };
    let res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);

    // Choose size "85x200"
    state = {
      ...res,
      action: { id: "SELECT_SELECTION", payload: { selectionId: "85x200" } },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "PRODUCT_DETAILS");

    // Click ORDER_NOW
    state = {
      ...res,
      action: { id: "ORDER_NOW", payload: { productId: "roll-up-banner", selectionId: "85x200" } },
    };
    res = await salesBrain.execute(state);

    // 2. Requirement step
    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
    assert.equal(res.response.context.requirement.id, "artwork");

    // Provide artwork requirement answer
    state = {
      ...res,
      action: { id: "SET_REQUIREMENT", payload: { requirementId: "artwork", value: "have_artwork" } },
    };
    res = await salesBrain.execute(state);

    // 3. Quotation step
    assert.equal(res.currentStep, DecisionTypes.QUOTATION);
    assert.ok(res.response.actions.some((a) => a.payload?.step === "quotation"));

    // Accept quotation
    state = {
      ...res,
      action: { id: "NEXT_STEP", payload: { step: "quotation", accepted: true } },
    };
    res = await salesBrain.execute(state);

    // 4. Artwork step
    assert.equal(res.currentStep, DecisionTypes.ARTWORK);

    // Provide artwork (simulate design assistance request)
    state = {
      ...res,
      action: { id: "SET_REQUIREMENT", payload: { requirementId: "designRequired", value: "need_design" } },
    };
    res = await salesBrain.execute(state);

    // 5. Delivery step
    assert.equal(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Choose pickup
    state = {
      ...res,
      action: { id: "SET_DELIVERY", payload: { method: "pickup" } },
    };
    res = await salesBrain.execute(state);

    // 6. Confirmation step
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);

    // Confirm order
    state = {
      ...res,
      action: { id: "CONFIRM_ORDER" },
    };
    res = await salesBrain.execute(state);

    // 7. Production step (post-confirmation step in Roll-Up Banner workflow)
    assert.equal(res.currentStep, DecisionTypes.PRODUCTION);
    assert.ok(res.response.actions.some((a) => a.payload?.step === "production"));

    // Proceed through production
    state = {
      ...res,
      action: { id: "NEXT_STEP", payload: { step: "production", confirmed: true } },
    };
    res = await salesBrain.execute(state);

    // 8. Dispatch step (final step in Roll-Up Banner workflow)
    assert.equal(res.currentStep, DecisionTypes.ORDER_COMPLETED);
    assert.equal(res.completed, true);
  });

  // ============================================================
  // Test F: Product with No Addons Never Shows Addons UI
  // ============================================================
  await suite.test("F. Product with no addons: never shows addon UI", async () => {
    // Roll-Up Banner has no addons in workflow and addons.enabled === false
    const banner = catalogService.getProduct("roll-up-banner");
    const bannerWorkflow = catalogService.getProductWorkflow(banner);
    assert.ok(!bannerWorkflow.some((s) => s.id === "addons" || s.type === "addons"));

    // Self ink stamps also has no addons
    const stamps = catalogService.getProduct("self-ink-stamps");
    const stampWorkflow = catalogService.getProductWorkflow(stamps);
    assert.ok(!stampWorkflow.some((s) => s.id === "addons" || s.type === "addons"));

    // Execute through stamps workflow
    let state = {
      action: { id: "SELECT_PRODUCT", payload: { productId: "self-ink-stamps" } },
    };
    let res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);

    // Select rectangle stamp
    res = await salesBrain.execute({ ...res, action: { id: "SELECT_SELECTION", payload: { productId: "self-ink-stamps", selectionId: "rectangle" } } });
    assert.equal(res.currentStep, "PRODUCT_DETAILS");

    // Click ORDER NOW
    res = await salesBrain.execute({ ...res, action: { id: "ORDER_NOW", payload: { productId: "self-ink-stamps", selectionId: "rectangle" } } });
    assert.notEqual(res.currentStep, DecisionTypes.SELECT_ADDONS);

    // Field 1: tradeLicense
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "tradeLicense");

    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "tradeLicense", value: true } } });
    // Field 2: emiratesId
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "emiratesId");

    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "emiratesId", value: true } } });

    // Review order
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);
  });

  // ============================================================
  // Test G: Product with No Delivery Never Invents Delivery
  // ============================================================
  await suite.test("G. Product with no delivery: never invents delivery", async () => {
    // Self Ink Stamps defines workflow: ["selection", "fields"], NO delivery
    let state = {
      action: { id: "SELECT_PRODUCT", payload: { productId: "self-ink-stamps" } },
    };
    let res = await salesBrain.execute(state);
    res = await salesBrain.execute({ ...res, action: { id: "SELECT_SELECTION", payload: { productId: "self-ink-stamps", selectionId: "rectangle" } } });
    res = await salesBrain.execute({ ...res, action: { id: "ORDER_NOW", payload: { productId: "self-ink-stamps", selectionId: "rectangle" } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "tradeLicense", value: true } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "emiratesId", value: true } } });

    // Must advance straight to REVIEW_ORDER without asking for delivery
    assert.notEqual(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);
    assert.notEqual(res.currentStep, DecisionTypes.DELIVERY_ADDRESS);
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);
  });

  // ============================================================
  // Test H: Optional Requirement Allows Skip
  // ============================================================
  await suite.test("H. Optional requirement: customer can skip", async () => {
    // In Business Cards, designRequired is optional (required: false)
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 500 } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "numberOfNames", value: 1 } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "material", value: "350gsm Art Matt" } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "lamination", value: "none" } } });
    res = await salesBrain.execute({ ...res, action: { id: "SET_DELIVERY", payload: { method: "pickup" } } });

    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
    assert.equal(res.response.context.requirement.required, false);
    assert.ok(res.response.actions.some((a) => a.payload?.value === "skipped" || a.label === "Skip"));

    // User skips
    state = {
      ...res,
      action: { id: "SET_REQUIREMENT", payload: { requirementId: "designRequired", value: "skipped" } },
    };
    res = await salesBrain.execute(state);

    // Advances to addons
    assert.equal(res.currentStep, DecisionTypes.SELECT_ADDONS);
  });

  // ============================================================
  // Test I: Required Requirement Blocks
  // ============================================================
  await suite.test("I. Required requirement: customer cannot continue until completed", async () => {
    // Roll-Up Banner artwork requirement has required: true
    let state = {
      action: { id: "SELECT_PRODUCT", payload: { productId: "roll-up-banner" } },
    };
    let res = await salesBrain.execute(state);
    res = await salesBrain.execute({ ...res, action: { id: "SELECT_SELECTION", payload: { productId: "roll-up-banner", selectionId: "85x200" } } });
    res = await salesBrain.execute({ ...res, action: { id: "ORDER_NOW", payload: { productId: "roll-up-banner", selectionId: "85x200" } } });

    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
    assert.equal(res.response.context.requirement.required, true);
    // Skip option must NOT be present
    assert.ok(!res.response.actions.some((a) => a.payload?.value === "skipped"));

    // Attempting to type "skip" or unrelated message does not advance
    state = {
      ...res,
      action: null,
      message: "skip",
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
  });

  // ============================================================
  // Test J: Cancellation at Active Step Resets State Completely
  // ============================================================
  await suite.test("J. Customer cancels at active step: state resets completely, sends clean greeting, zero images of cancelled product", async () => {
    // Start business cards order
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);
    res = await salesBrain.execute({ ...res, action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 500 } } });

    // Cancel order
    state = {
      ...res,
      action: { id: "CANCEL_ORDER" },
    };
    res = await salesBrain.execute(state);

    assert.equal(res.currentStep, DecisionTypes.CANCEL_ORDER);
    assert.equal(res.liveRequirement, null);
    assert.equal(res.productId ?? null, null);
    assert.equal(res.selectedProduct ?? null, null);

    // Next customer message sends clean greeting with zero images
    state = {
      ...res,
      action: null,
      message: "hi",
    };
    res = await salesBrain.execute(state);

    assert.equal(res.currentStep, DecisionTypes.START_ORDER);
    const waMessages = responseAdapter.toWhatsAppMessages(res);
    assert.ok(waMessages.length > 0);
    // Must NOT contain an image of the cancelled business cards
    const imageMsg = waMessages.find((m) => m.type === "image");
    assert.equal(imageMsg, undefined);
  });

  // ============================================================
  // Test K: Customer Selects Different Product After Cancel
  // ============================================================
  await suite.test("K. Customer selects different product after cancel: workflow starts fresh for new product", async () => {
    // Start and cancel business cards
    let res = await salesBrain.execute({ action: { id: "ORDER_NOW", payload: { productId: "affordable" } } });
    res = await salesBrain.execute({ ...res, action: { id: "CANCEL_ORDER" } });

    // Start Roll-Up Banner
    res = await salesBrain.execute({
      ...res,
      action: { id: "SELECT_PRODUCT", payload: { productId: "roll-up-banner" } },
    });

    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);
    const currentItem = res.liveRequirement.items[0];
    assert.equal(currentItem.product.id, "roll-up-banner");
    assert.notEqual(currentItem.product.id, "affordable");
    assert.notEqual(currentItem.product.id, "business-cards");
  });

  // ============================================================
  // Test L: Customer Completes Order -> Next Message Starts Fresh
  // ============================================================
  await suite.test("L. Customer completes order: state resets, next message starts fresh catalog order", async () => {
    // Completed order state
    const completedState = {
      completed: true,
      confirmed: true,
      currentStep: "ORDER_COMPLETED",
      liveRequirement: {
        orderNumber: "ORD-12345",
        status: "CONFIRMED",
        items: [{ product: { id: "affordable", name: "Affordable Business Cards" } }],
      },
    };

    // Customer sends message to start new order
    const nextRes = await salesBrain.execute({
      ...completedState,
      action: null,
      message: "I need roll-up banners",
    });

    // Old order state must not block or interfere with the new product
    assert.notEqual(nextRes.currentStep, "ORDER_COMPLETED");
    const currentItem = nextRes.liveRequirement.items[0];
    assert.equal(currentItem.product.id, "roll-up-banner");
  });

  // ============================================================
  // Test M: Customer Types Selection ("2", "second", option name)
  // ============================================================
  await suite.test("M. Customer types selection ('2', 'second', option name): resolves against current catalog options", async () => {
    // 1. Resolve by numeric option index "2"
    let state = {
      action: { id: "SELECT_PRODUCT", payload: { productId: "business-cards" } },
    };
    let res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);

    // User types "2" -> maps to 2nd option ("premium")
    res = await salesBrain.execute({
      ...res,
      action: null,
      message: "2",
    });
    assert.equal(res.currentStep, "SELECT_NESTED_PRODUCT");
    assert.equal(res.liveRequirement.items[0].selection.id, "premium");

    // 2. Resolve by ordinal word "first" for field
    res = await salesBrain.execute({ action: { id: "ORDER_NOW", payload: { productId: "affordable" } } });
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "quantity");

    // Quantity options: 1: 100, 2: 200, 3: 300, 4: 500, 5: 1000
    // User types "fourth"
    res = await salesBrain.execute({
      ...res,
      action: null,
      message: "fourth",
    });
    assert.equal(res.liveRequirement.items[0].formData.quantity, 500);
    assert.equal(res.response.context.field.id, "numberOfNames");
  });

  // ============================================================
  // Test N: Button Selection Resolves Through Same Canonical Logic
  // ============================================================
  await suite.test("N. Customer clicks button selection: resolves through same canonical action logic as typed selection", async () => {
    // Flow 1: Button click
    let btnRes = await salesBrain.execute({ action: { id: "ORDER_NOW", payload: { productId: "affordable" } } });
    btnRes = await salesBrain.execute({
      ...btnRes,
      action: { id: "SET_FIELD", payload: { fieldId: "quantity", value: 500 } },
    });

    // Flow 2: Typed selection
    let textRes = await salesBrain.execute({ action: { id: "ORDER_NOW", payload: { productId: "affordable" } } });
    textRes = await salesBrain.execute({
      ...textRes,
      action: null,
      message: "500",
    });

    // Both must result in identical field value and next step
    assert.equal(btnRes.currentStep, textRes.currentStep);
    assert.equal(
      btnRes.liveRequirement.items[0].formData.quantity,
      textRes.liveRequirement.items[0].formData.quantity,
    );
    assert.equal(
      btnRes.response.context.field.id,
      textRes.response.context.field.id,
    );
  });

  // ============================================================
  // Test O: Canonical ORDER_NOW with parent productId and selectionId
  // ============================================================
  await suite.test("O. Canonical ORDER_NOW with parent productId and selectionId (roll-up-banner + 85x200)", async () => {
    // 1. PRODUCT_DETAILS generates canonical ORDER_NOW payload
    const product = catalogService.getProduct("roll-up-banner");
    const selection = catalogService.getSelectionOption(product, "85x200");
    const details = decisionService.buildProductDetails(product, selection, product);

    assert.equal(details.type, "PRODUCT_DETAILS");
    const orderNowAction = details.actions.find((a) => a.id === "ORDER_NOW");
    assert.ok(orderNowAction, "ORDER_NOW action must be present");
    assert.equal(orderNowAction.payload.productId, "roll-up-banner");
    assert.equal(orderNowAction.payload.selectionId, "85x200");

    // 2. SalesBrain executes canonical ORDER_NOW
    const res = await salesBrain.execute({
      action: orderNowAction,
    });

    assert.notEqual(res.currentStep, "ERROR");
    assert.equal(res.workflow, "SALES");
    const currentItem = res.liveRequirement.items[0];
    assert.equal(currentItem.product.id, "roll-up-banner");
    assert.equal(currentItem.selection.id, "85x200");
    assert.equal(currentItem.orderStarted, true);

    // 3. Response media policy: NO product image after ORDER_NOW
    const messages = responseAdapter.toWhatsAppMessages(res);
    const imageMsg = messages.find((m) => m.type === "image" || m.interactive?.header?.type === "image");
    assert.equal(imageMsg, undefined, "Zero product images allowed once order flow starts");
  });

  // ============================================================
  // Test P: Old broken payload (productId = variantId '85x200') is rejected safely without CANCEL
  // ============================================================
  await suite.test("P. Old broken payload (productId = '85x200') rejected safely without cancellation or state reset", async () => {
    // Pre-existing valid state
    const priorState = {
      workflow: "SALES",
      currentStep: "PRODUCT_DETAILS",
      liveRequirement: {
        items: [{ product: { id: "roll-up-banner", name: "Roll-Up Banner" } }],
      },
    };

    const res = await salesBrain.execute({
      ...priorState,
      action: {
        id: "ORDER_NOW",
        payload: { productId: "85x200" }, // Variant ID passed as productId
      },
    });

    assert.equal(res.currentStep, "ERROR");
    assert.notEqual(res.workflow, "NONE");
    assert.equal(res.metadata?.stage !== "CANCELLED", true);
    assert.equal(res.response.metadata?.cancelled !== true, true);
    assert.ok(res.response.message.includes("no longer available") || res.response.message.includes("select"));
  });

  // ============================================================
  // Test Q: Invalid selection & Cross-product selection rejected safely
  // ============================================================
  await suite.test("Q. Invalid and cross-product selection rejected safely without cancellation", async () => {
    // 1. Non-existent selection
    const resInvalid = await salesBrain.execute({
      action: {
        id: "ORDER_NOW",
        payload: { productId: "roll-up-banner", selectionId: "non-existent-size" },
      },
    });
    assert.equal(resInvalid.currentStep, "ERROR");
    assert.equal(resInvalid.metadata?.stage !== "CANCELLED", true);

    // 2. Cross-product selection (round stamp option on roll-up banner)
    const resCross = await salesBrain.execute({
      action: {
        id: "ORDER_NOW",
        payload: { productId: "roll-up-banner", selectionId: "round" },
      },
    });
    assert.equal(resCross.currentStep, "ERROR");
    assert.equal(resCross.metadata?.stage !== "CANCELLED", true);
  });

  // ============================================================
  // Test R: Missing productId or required selectionId rejected safely
  // ============================================================
  await suite.test("R. Missing productId or required selectionId rejected safely", async () => {
    // 1. Missing productId
    const resNoProd = await salesBrain.execute({
      action: { id: "ORDER_NOW", payload: {} },
    });
    assert.equal(resNoProd.currentStep, "ERROR");
    assert.equal(resNoProd.metadata?.stage !== "CANCELLED", true);

    // 2. Missing selectionId for product that requires selection
    const resNoSel = await salesBrain.execute({
      action: { id: "ORDER_NOW", payload: { productId: "roll-up-banner" } },
    });
    assert.equal(resNoSel.currentStep, "ERROR");
    assert.equal(resNoSel.metadata?.stage !== "CANCELLED", true);
  });

  // ============================================================
  // Test S: Duplicate ORDER_NOW maintains single active order
  // ============================================================
  await suite.test("S. Duplicate ORDER_NOW maintains single active order", async () => {
    const action = {
      id: "ORDER_NOW",
      payload: { productId: "roll-up-banner", selectionId: "85x200" },
    };

    let res1 = await salesBrain.execute({ action });
    assert.equal(res1.liveRequirement.items.length, 1);

    // Second identical ORDER_NOW
    let res2 = await salesBrain.execute({ ...res1, action });
    assert.equal(res2.liveRequirement.items.length, 1);
    assert.equal(res2.liveRequirement.items[0].product.id, "roll-up-banner");
  });

  // ============================================================
  // Test T: Stale ORDER_NOW across products rejected without cancelling active order
  // ============================================================
  await suite.test("T. Stale ORDER_NOW button clicked during active order of different product", async () => {
    // Active order for business cards
    let activeState = await salesBrain.execute({
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    });
    assert.equal(activeState.liveRequirement.items[0].product.id, "affordable");

    // Stale ORDER_NOW for roll-up-banner arrives
    let staleRes = await salesBrain.execute({
      ...activeState,
      action: {
        id: "ORDER_NOW",
        payload: { productId: "roll-up-banner", selectionId: "85x200" },
      },
    });

    assert.equal(staleRes.currentStep, "ERROR");
    // Active order for affordable business cards was not cancelled
    assert.equal(staleRes.metadata?.stage !== "CANCELLED", true);
  });

  // ============================================================
  // Test U: Explicit CANCEL is idempotent and preserves customer profile
  // ============================================================
  await suite.test("U. Explicit CANCEL is idempotent and preserves customer profile", async () => {
    // 1. Active order with customer profile
    let state = await salesBrain.execute({
      customer: { name: "Jane Smith", phone: "971509999999", email: "jane@example.com", company: "PrintHub" },
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    });

    // 2. Cancel order
    let cancelledState = await salesBrain.execute({
      ...state,
      action: { id: "CANCEL_ORDER" },
    });
    assert.equal(cancelledState.currentStep, DecisionTypes.CANCEL_ORDER);
    assert.equal(cancelledState.liveRequirement, null);
    // Customer profile is preserved!
    assert.equal(cancelledState.customer.name, "Jane Smith");
    assert.equal(cancelledState.customer.email, "jane@example.com");

    // 3. Repeated CANCEL is safe and harmless
    let repeatCancel = await salesBrain.execute({
      ...cancelledState,
      action: { id: "CANCEL_ORDER" },
    });
    assert.equal(repeatCancel.currentStep, DecisionTypes.CANCEL_ORDER);
    assert.equal(repeatCancel.customer.name, "Jane Smith");
  });

  // ============================================================
  // Test V: WhatsappActionCodec encoding & decoding roundtrip
  // ============================================================
  await suite.test("V. WhatsappActionCodec encoding & decoding roundtrip for ORDER_NOW", () => {
    const action = {
      id: "ORDER_NOW",
      type: "ORDER_NOW",
      label: "ORDER NOW",
      payload: {
        productId: "roll-up-banner",
        selectionId: "85x200",
      },
    };

    const encoded = WhatsappActionCodec.encode(action);
    assert.equal(encoded, "order_now:roll-up-banner:85x200");

    const decoded = WhatsappActionCodec.decode(encoded);
    assert.equal(decoded.id, "ORDER_NOW");
    assert.equal(decoded.payload.productId, "roll-up-banner");
    assert.equal(decoded.payload.selectionId, "85x200");
  });

  // ============================================================
  // Test W: Complete Real Catalog Integration: Discovery -> Selection -> ORDER_NOW -> Requirements -> Artwork -> Delivery -> Confirmation
  // ============================================================
  await suite.test("W. Complete Real Catalog Integration for Roll-Up Banner", async () => {
    // Step 1: Select product
    let res = await salesBrain.execute({
      action: { id: "SELECT_PRODUCT", payload: { productId: "roll-up-banner" } },
    });
    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);

    // Step 2: Select variant
    res = await salesBrain.execute({
      ...res,
      action: {
        id: "SELECT_SELECTION",
        payload: { productId: "roll-up-banner", selectionId: "85x200" },
      },
    });
    assert.equal(res.currentStep, "PRODUCT_DETAILS");

    // Step 3: ORDER_NOW
    res = await salesBrain.execute({
      ...res,
      action: {
        id: "ORDER_NOW",
        payload: { productId: "roll-up-banner", selectionId: "85x200" },
      },
    });
    assert.equal(res.currentStep, DecisionTypes.COLLECT_REQUIREMENT);
    assert.equal(res.liveRequirement.items[0].product.id, "roll-up-banner");
    assert.equal(res.liveRequirement.items[0].selection.id, "85x200");

    // Step 4: Requirement (Artwork)
    res = await salesBrain.execute({
      ...res,
      action: { id: "SET_REQUIREMENT", payload: { requirementId: "artwork", value: "have_artwork" } },
    });
    assert.equal(res.currentStep, DecisionTypes.QUOTATION);

    // Step 5: Quotation review
    res = await salesBrain.execute({
      ...res,
      action: { id: "NEXT_STEP", payload: { step: "quotation", accepted: true } },
    });
    assert.equal(res.currentStep, DecisionTypes.ARTWORK);

    // Step 6: Artwork (design assistance)
    res = await salesBrain.execute({
      ...res,
      action: { id: "SET_REQUIREMENT", payload: { requirementId: "designRequired", value: "need_design" } },
    });
    assert.equal(res.currentStep, DecisionTypes.SELECT_DELIVERY_METHOD);

    // Step 7: Delivery method
    res = await salesBrain.execute({
      ...res,
      action: { id: "SET_DELIVERY", payload: { method: "delivery" } },
    });
    assert.equal(res.currentStep, DecisionTypes.DELIVERY_ADDRESS);

    // Step 8: Delivery address
    res = await salesBrain.execute({
      ...res,
      message: "Warehouse 4, Al Quoz Industrial Area 3, Dubai",
    });
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);

    // Step 9: Confirm order
    res = await salesBrain.execute({
      ...res,
      customer: { name: "Ahmed Al-Maktoum", email: "ahmed@example.ae", company: "Dubai Expo" },
      action: { id: "CONFIRM_ORDER" },
    });
    assert.equal(res.currentStep, DecisionTypes.PRODUCTION);

    // Step 10: Production step -> Completed
    res = await salesBrain.execute({
      ...res,
      action: { id: "NEXT_STEP", payload: { step: "production", confirmed: true } },
    });
    assert.equal(res.currentStep, DecisionTypes.ORDER_COMPLETED);
    assert.equal(res.completed, true);
  });
});

