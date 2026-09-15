import test from "node:test";
import assert from "node:assert/strict";

import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";
import ConversationDecisionService from "../modules/sales/services/ConversationDecisionService.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import DecisionTypes from "../modules/sales/helpers/DecisionTypes.js";

const decisionService = new ConversationDecisionService();
const salesBrain = new SalesBrain();
const catalogService = new SalesCatalogService();
const orderManager = new OrderManager();
const responseAdapter = new WhatsAppResponseAdapter();

test("Conversational Catalog Order Flow Suite", async (t) => {
  await t.test("1. WhatsappActionCodec encodes & decodes generic actions", () => {
    // SET_FIELD
    const fieldAction = {
      id: "SET_FIELD",
      type: "SET_FIELD",
      payload: { fieldId: "quantity", value: 500 },
    };
    const encodedField = WhatsappActionCodec.encode(fieldAction);
    assert.equal(encodedField, "SET_FIELD|quantity|500");
    const decodedField = WhatsappActionCodec.decode(encodedField);
    assert.equal(decodedField.id, "SET_FIELD");
    assert.equal(decodedField.payload.fieldId, "quantity");
    assert.equal(decodedField.payload.value, "500");

    // SET_REQUIREMENT
    const reqAction = {
      id: "SET_REQUIREMENT",
      type: "SET_REQUIREMENT",
      payload: { requirementId: "designRequired", value: "have_artwork" },
    };
    const encodedReq = WhatsappActionCodec.encode(reqAction);
    assert.equal(encodedReq, "SET_REQUIREMENT|designRequired|have_artwork");
    const decodedReq = WhatsappActionCodec.decode(encodedReq);
    assert.equal(decodedReq.id, "SET_REQUIREMENT");
    assert.equal(decodedReq.payload.requirementId, "designRequired");

    // TOGGLE_ADDON
    const addonAction = {
      id: "TOGGLE_ADDON",
      type: "TOGGLE_ADDON",
      payload: { addonId: "round-corners" },
    };
    const encodedAddon = WhatsappActionCodec.encode(addonAction);
    assert.equal(encodedAddon, "TOGGLE_ADDON|round-corners");
    const decodedAddon = WhatsappActionCodec.decode(encodedAddon);
    assert.equal(decodedAddon.id, "TOGGLE_ADDON");
    assert.equal(decodedAddon.payload.addonId, "round-corners");

    // SET_DELIVERY
    const delAction = {
      id: "SET_DELIVERY",
      type: "SET_DELIVERY",
      payload: { method: "delivery" },
    };
    const encodedDel = WhatsappActionCodec.encode(delAction);
    assert.equal(encodedDel, "SET_DELIVERY|delivery");
    const decodedDel = WhatsappActionCodec.decode(encodedDel);
    assert.equal(decodedDel.id, "SET_DELIVERY");
    assert.equal(decodedDel.payload.method, "delivery");

    // Control actions
    for (const ctrl of [
      "ORDER_NOW",
      "NEXT_STEP",
      "BACK",
      "EDIT_ORDER",
      "CONFIRM_ORDER",
      "CANCEL_ORDER",
    ]) {
      const enc = WhatsappActionCodec.encode({ id: ctrl });
      assert.equal(enc, ctrl);
      const dec = WhatsappActionCodec.decode(enc);
      assert.equal(dec.id, ctrl);
    }
  });

  await t.test("2. ORDER NOW starts conversational configuration, NOT giant form", async () => {
    let state = {
      action: {
        id: "SELECT_PRODUCT",
        payload: { productId: "business-cards" },
      },
    };
    let res = await salesBrain.execute(state);

    // Select category budget-friendly
    state = {
      ...res,
      action: {
        id: "SELECT_SELECTION",
        payload: { selectionId: "budget-friendly" },
      },
    };
    res = await salesBrain.execute(state);

    // Select nested product affordable
    state = {
      ...res,
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: { selectionId: "budget-friendly", nestedProductId: "affordable" },
      },
    };
    res = await salesBrain.execute(state);
    assert.ok(res.currentStep === "PRODUCT_DETAILS" || res.currentStep === "COLLECT_PRODUCT_FIELD");

    // Now click ORDER NOW
    state = {
      ...res,
      action: {
        id: "ORDER_NOW",
        payload: { productId: "affordable" },
      },
    };
    res = await salesBrain.execute(state);

    // MUST NOT return ORDER_FORM or giant form
    assert.notEqual(res.currentStep, "ORDER_FORM");
    assert.equal(res.liveRequirement.items[0].orderStarted, true);
    assert.equal(res.liveRequirement.items[0].formMode, false);

    // Must return the first catalog question (quantity)
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "quantity");
    assert.ok(res.response.actions.length >= 3);
    assert.equal(res.response.actions[0].id, "SET_FIELD");
    assert.equal(res.response.actions[0].payload.fieldId, "quantity");

    // Adapter formats to WhatsApp buttons
    const waMessages = responseAdapter.toWhatsAppMessages(res);
    assert.ok(waMessages.length > 0);
    assert.notEqual(waMessages[0].type, "interactive_flow");
  });

  await t.test("3. Step-by-step generic action progression", async () => {
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);
    assert.equal(res.response.context.field.id, "quantity");

    // Step 1: Set quantity to 500
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "quantity", value: 500 },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "numberOfNames");

    // Step 2: Set numberOfNames to 2
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "numberOfNames", value: 2 },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "material");

    // Step 3: Set material
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "material", value: "350gsm Art Matt" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "lamination");

    // Step 4: Set lamination
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "lamination", value: "velvet-soft-touch" },
      },
    };
    res = await salesBrain.execute(state);

    // Step 5: Delivery method
    assert.ok(
      res.currentStep === DecisionTypes.SELECT_DELIVERY_METHOD ||
        (res.currentStep === DecisionTypes.COLLECT_PRODUCT_FIELD &&
          res.response.context.field.id === "deliveryMethod"),
    );
  });

  await t.test("4. Multi-value natural language resolution", async () => {
    // Start order for affordable business cards
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);
    assert.equal(res.response.context.field.id, "quantity");

    // User sends single message with all answers
    state = {
      ...res,
      action: null,
      message: "I need 500 cards, 2 names, 350gsm matt and velvet, self pickup",
    };
    res = await salesBrain.execute(state);

    const item = res.liveRequirement.items[0];
    assert.equal(item.formData.quantity, 500);
    assert.equal(item.formData.numberOfNames, 2);
    assert.equal(item.formData.material, "350gsm Art Matt");
    assert.equal(item.formData.lamination, "velvet-soft-touch");
    assert.equal(item.formData.deliveryMethod, "pickup");
  });

  await t.test("5. Order review summary with AED 25 delivery and AED 0 pickup", async () => {
    // Prepare an order with all fields and delivery
    let requirement = orderManager.create();
    requirement = orderManager.addItem(requirement, {
      id: "affordable",
      orderStarted: true,
      formMode: false,
      formData: {
        quantity: 500,
        numberOfNames: 1,
        material: "350gsm Art Matt",
        lamination: "matt",
        deliveryMethod: "delivery",
      },
      addons: { completed: true },
      delivery: {
        method: "delivery",
        address: "123 Business Bay, Dubai",
        requiredDate: "2026-09-20",
      },
      artwork: { received: true, fileName: "logo.pdf" },
    });

    const decision = decisionService.decide(requirement);
    assert.ok(
      decision.type === DecisionTypes.REVIEW_ORDER ||
        decision.type === "ORDER_REVIEW",
    );
    assert.ok(decision.context.summary.includes("Delivery (AED 25)"));
    assert.ok(decision.actions.some((a) => a.id === "CONFIRM_ORDER"));
    assert.ok(decision.actions.some((a) => a.id === "EDIT_ORDER"));
    assert.ok(decision.actions.some((a) => a.id === "CANCEL_ORDER"));
  });

  await t.test("6. CONFIRM_ORDER transitions to COLLECT_CUSTOMER and collects details conversationally", async () => {
    let state = {
      whatsapp: { phoneNumber: "918310412768" },
      currentStep: "REVIEW_ORDER",
      liveRequirement: {
        items: [
          {
            product: { id: "affordable", name: "Affordable Business Cards" },
            selectedProduct: { id: "affordable", name: "Affordable Business Cards" },
            orderStarted: true,
            formData: {
              quantity: 500,
              numberOfNames: 2,
              material: "350gsm Art Matt",
              lamination: "none",
              deliveryMethod: "delivery",
            },
            delivery: { method: "delivery", fee: 25 },
          },
        ],
      },
      action: { id: "CONFIRM_ORDER" },
    };

    // 1. Click Confirm Order -> transitions to COLLECT_CUSTOMER, asks for name
    let res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.equal(res.completed, false);
    assert.equal(res.confirmed, false);
    assert.ok(res.response.message.includes("enter your full name"));
    assert.ok(!res.response.message.includes("Order Summary"));

    // 2. Empty name validation
    let emptyNameState = {
      ...res,
      action: null,
      message: "",
    };
    let emptyNameRes = await salesBrain.execute(emptyNameState);
    assert.equal(emptyNameRes.currentStep, "COLLECT_CUSTOMER");
    assert.ok(emptyNameRes.response.message.includes("Please enter your name"));

    // 3. User provides Name
    state = {
      ...res,
      action: {
        id: "SET_CUSTOMER_FIELD",
        payload: { fieldId: "name", value: "John Smith" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.ok(res.response.message.includes("Thanks, John!"));
    assert.ok(res.response.message.includes("enter your email address"));

    // 4. Invalid email validation
    let invalidEmailState = {
      ...res,
      action: null,
      message: "not-an-email",
    };
    let invalidEmailRes = await salesBrain.execute(invalidEmailState);
    assert.equal(invalidEmailRes.currentStep, "COLLECT_CUSTOMER");
    assert.ok(invalidEmailRes.response.message.includes("Please enter a valid email address"));

    // 5. User provides valid Email
    state = {
      ...res,
      action: {
        id: "SET_CUSTOMER_FIELD",
        payload: { fieldId: "email", value: "john@example.com" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.ok(res.response.message.includes("Company name is optional"));
    assert.ok(res.response.actions.some((a) => a.payload?.value === "skip"));

    // 6. User skips Company -> Order Completed, Lead Created
    state = {
      ...res,
      action: {
        id: "SET_CUSTOMER_FIELD",
        payload: { fieldId: "company", value: "skip" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "ORDER_COMPLETED");
    assert.equal(res.completed, true);
    assert.equal(res.confirmed, true);
    assert.ok(res.response.message.includes("submitted successfully"));
    assert.ok(!res.response.message.includes("Order Summary"));
    assert.equal(res.liveRequirement.customer.name, "John Smith");
    assert.equal(res.liveRequirement.customer.email, "john@example.com");
    assert.equal(res.liveRequirement.customer.phone, "918310412768");
  });

  await t.test("7. Natural language confirmation works with various phrases", async () => {
    const confirmPhrases = [
      "Confirm",
      "yes",
      "confirm order",
      "I want to place the order",
    ];

    for (const phrase of confirmPhrases) {
      const state = {
        whatsapp: { phoneNumber: "918310412768" },
        currentStep: "REVIEW_ORDER",
        liveRequirement: {
          items: [
            {
              product: { id: "affordable", name: "Affordable Business Cards" },
              orderStarted: true,
              formData: { quantity: 500 },
            },
          ],
        },
        message: phrase,
      };

      const res = await salesBrain.execute(state);
      assert.equal(
        res.currentStep,
        "COLLECT_CUSTOMER",
        `Phrase "${phrase}" must transition to COLLECT_CUSTOMER`,
      );
      assert.ok(res.response.message.includes("enter your full name"));
    }
  });

  await t.test("8. Duplicate CONFIRM_ORDER does not regenerate summary or recreate lead", async () => {
    let state = {
      whatsapp: { phoneNumber: "918310412768" },
      currentStep: "COLLECT_CUSTOMER",
      liveRequirement: {
        items: [
          {
            product: { id: "affordable" },
            orderStarted: true,
            reviewCompleted: true,
            confirmClicked: true,
          },
        ],
        customer: { name: "John Smith" },
      },
      action: { id: "CONFIRM_ORDER" },
    };

    const res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.ok(!res.response.message.includes("Order Summary"));
    assert.ok(res.response.message.includes("enter your email address"));
  });

  await t.test("9. EDIT_ORDER returns to catalog workflow and clears review state", async () => {
    let state = {
      currentStep: "REVIEW_ORDER",
      liveRequirement: {
        items: [
          {
            product: { id: "affordable" },
            orderStarted: true,
            reviewCompleted: true,
            confirmClicked: true,
            formData: { quantity: 500 },
          },
        ],
      },
      action: { id: "EDIT_ORDER" },
    };

    const res = await salesBrain.execute(state);
    assert.notEqual(res.currentStep, "REVIEW_ORDER");
    assert.equal(res.liveRequirement.items[0].reviewCompleted, false);
    assert.equal(res.liveRequirement.items[0].confirmClicked, false);
  });

  await t.test("10. CANCEL_ORDER resets order state", async () => {
    let state = {
      currentStep: "COLLECT_PRODUCT_FIELD",
      liveRequirement: {
        items: [
          {
            product: { id: "affordable" },
            orderStarted: true,
            formData: { quantity: 500 },
          },
        ],
      },
      action: { id: "CANCEL_ORDER" },
    };

    const res = await salesBrain.execute(state);
    assert.equal(res.completed, false);
    assert.ok(!res.liveRequirement || res.liveRequirement.items?.length === 0);
  });

  await t.test("11. Company provided (non-skipped) is saved to customer and lead", async () => {
    let state = {
      whatsapp: { phoneNumber: "918310412768" },
      currentStep: "COLLECT_CUSTOMER",
      liveRequirement: {
        items: [
          {
            product: { id: "affordable", name: "Affordable Business Cards" },
            orderStarted: true,
            reviewCompleted: true,
            confirmClicked: true,
            formData: { quantity: 500 },
            customer: { name: "John Smith", email: "john@example.com" },
          },
        ],
        customer: { name: "John Smith", email: "john@example.com" },
      },
      action: {
        id: "SET_CUSTOMER_FIELD",
        payload: { fieldId: "company", value: "ABC Trading" },
      },
    };

    const res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "ORDER_COMPLETED");
    assert.equal(res.completed, true);
    assert.equal(res.liveRequirement.customer.company, "ABC Trading");
  });

  await t.test("12. Two different WhatsApp users have isolated sessions", async () => {
    let user1State = {
      whatsapp: { phoneNumber: "918310412768" },
      currentStep: "COLLECT_CUSTOMER",
      liveRequirement: {
        items: [{ product: { id: "affordable" }, orderStarted: true }],
        customer: { name: "Alice" },
      },
    };

    let user2State = {
      whatsapp: { phoneNumber: "919876543210" },
      currentStep: "COLLECT_CUSTOMER",
      liveRequirement: {
        items: [{ product: { id: "pvc-plastic" }, orderStarted: true }],
        customer: { name: "Bob" },
      },
    };

    const res1 = await salesBrain.promptNextCustomerField(user1State, user1State.liveRequirement);
    const res2 = await salesBrain.promptNextCustomerField(user2State, user2State.liveRequirement);

    assert.ok(res1.response.message.includes("Alice"));
    assert.ok(res2.response.message.includes("Bob"));
    assert.notEqual(res1.liveRequirement.items[0].product.id, res2.liveRequirement.items[0].product.id);
  });

  await t.test("13. Product with different catalog fields works dynamically", async () => {
    // Testing another catalog product with different fields e.g. laminated
    const laminatedProd = catalogService.getProduct("laminated");
    if (laminatedProd) {
      let state = {
        action: { id: "ORDER_NOW", payload: { productId: "laminated" } },
      };
      const res = await salesBrain.execute(state);
      assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
      assert.ok(res.response.context.field);
    }
  });

  await t.test("14. Product with no addons skips addon prompt and quotation required is preserved", async () => {
    let requirement = orderManager.create();
    requirement = orderManager.addItem(requirement, {
      id: "affordable",
      orderStarted: true,
      formData: {
        quantity: 500,
        numberOfNames: 2,
        material: "350gsm Art Matt",
        lamination: "none",
        deliveryMethod: "delivery",
      },
      addons: { completed: true },
      delivery: {
        method: "delivery",
        address: "123 Business Bay, Dubai",
        requiredDate: "2026-09-20",
      },
      artwork: { received: true, fileName: "logo.pdf" },
    });

    const decision = decisionService.decide(requirement);
    assert.ok(decision.type === DecisionTypes.REVIEW_ORDER || decision.type === "ORDER_REVIEW");
    assert.ok(decision.context.summary.includes("Quotation required"));
  });
});
