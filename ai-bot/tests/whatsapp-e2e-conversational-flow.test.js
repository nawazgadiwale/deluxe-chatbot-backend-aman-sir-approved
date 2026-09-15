import test from "node:test";
import assert from "node:assert/strict";

import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import ConversationDecisionService from "../modules/sales/services/ConversationDecisionService.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import DecisionTypes from "../modules/sales/helpers/DecisionTypes.js";
import SalesExtractor from "../modules/sales/extractors/SalesExtractor.js";

const salesBrain = new SalesBrain();
const catalogService = new SalesCatalogService();
const decisionService = new ConversationDecisionService();
const responseAdapter = new WhatsAppResponseAdapter();
const extractor = new SalesExtractor();

// Helper to spy on console.log and capture log sequence
function spyLogs() {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(" "));
    originalLog(...args);
  };
  return {
    getLogs: () => logs,
    restore: () => {
      console.log = originalLog;
    },
  };
}

test("WhatsApp E2E Conversational Flow Suite", async (t) => {
  // =========================================================================
  // 1. FULL HAPPY PATH CONVERSATIONAL ORDER FLOW (Section 30 Sequence)
  // =========================================================================
  await t.test("1. Full Section 30 Conversational Flow: Greeting -> Delivery -> Artwork -> Order Completed", async () => {
    const phoneNumber = "918310412768";
    let state = {
      whatsapp: { phoneNumber },
      message: "Hi",
    };

    // Step 1: Greeting
    let res = await salesBrain.execute(state);
    assert.equal(res.workflow, "SALES");
    assert.ok(
      res.currentStep === DecisionTypes.SELECT_PRODUCT ||
        res.currentStep === "SELECT_PRODUCT" ||
        res.response?.actions?.some((a) => a.id === "SELECT_PRODUCT"),
    );

    // Step 2: Select Catalog Product (Business Cards)
    state = {
      ...res,
      action: {
        id: "SELECT_PRODUCT",
        payload: { productId: "business-cards" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);
    assert.ok(res.response.actions.some((a) => a.payload?.selectionId === "budget-friendly"));

    // Step 3: Select Category (Budget-Friendly Business Cards)
    state = {
      ...res,
      action: {
        id: "SELECT_SELECTION",
        payload: { selectionId: "budget-friendly" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.SELECT_NESTED_PRODUCT);
    assert.ok(res.response.actions.some((a) => a.payload?.nestedProductId === "affordable"));

    // Step 4: Select Variant (Affordable Business Cards) -> Product Details
    state = {
      ...res,
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: { selectionId: "budget-friendly", nestedProductId: "affordable" },
      },
    };
    res = await salesBrain.execute(state);
    assert.ok(
      res.currentStep === "PRODUCT_DETAILS" ||
        res.currentStep === DecisionTypes.COLLECT_PRODUCT_FIELD,
    );

    // If at PRODUCT_DETAILS, click ORDER NOW to start configuration
    if (res.currentStep === "PRODUCT_DETAILS") {
      state = {
        ...res,
        action: {
          id: "ORDER_NOW",
          payload: { productId: "affordable" },
        },
      };
      res = await salesBrain.execute(state);
    }

    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "quantity");
    assert.equal(res.liveRequirement.items[0].orderStarted, true);
    assert.equal(res.liveRequirement.items[0].formMode, false);

    // Step 6: Customer selects/types Quantity: 200
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "quantity", value: 200 },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
    assert.equal(res.response.context.field.id, "numberOfNames");

    // Step 7: Customer selects/types Number of Names: 2
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

    // Step 8: Customer selects Material: 350gsm Art Matt
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

    // Step 9: Customer selects Lamination: No Lamination
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "lamination", value: "none" },
      },
    };
    res = await salesBrain.execute(state);

    // Step 10: Prompts Delivery Method (Delivery vs Pickup)
    assert.ok(
      res.currentStep === DecisionTypes.SELECT_DELIVERY_METHOD ||
        (res.currentStep === DecisionTypes.COLLECT_PRODUCT_FIELD &&
          res.response?.context?.field?.id === "deliveryMethod"),
      "Must prompt for delivery method",
    );
    assert.ok(
      res.response.actions.some(
        (a) =>
          a.payload?.method === "delivery" ||
          a.payload?.value === "delivery" ||
          a.id === "SET_DELIVERY",
      ),
    );

    // Step 11: Customer selects Delivery
    state = {
      ...res,
      action: {
        id: "SET_FIELD",
        payload: { fieldId: "deliveryMethod", value: "delivery" },
      },
    };
    res = await salesBrain.execute(state);

    // Step 12: Prompts Delivery Address
    assert.equal(res.currentStep, DecisionTypes.DELIVERY_ADDRESS);
    assert.ok(res.response.message.includes("Please share your delivery address."));

    // Step 13: Customer types Delivery Address: "101 Business Bay, Dubai"
    state = {
      ...res,
      action: null,
      message: "101 Business Bay, Dubai",
    };
    res = await salesBrain.execute(state);

    // Step 14: Prompts Delivery Date
    assert.equal(res.currentStep, DecisionTypes.DELIVERY_DATE);
    assert.ok(res.response.message.includes("Which date would you like to receive your order?"));

    // Step 15: Customer types Delivery Date: "15 September"
    state = {
      ...res,
      action: null,
      message: "15 September",
    };
    res = await salesBrain.execute(state);

    // Step 16: Prompts Artwork upload
    assert.equal(res.currentStep, DecisionTypes.ARTWORK);
    assert.ok(res.response.message.includes("Please send your artwork/design file here."));

    // Step 17: Customer uploads Artwork (WhatsApp media attachment)
    state = {
      ...res,
      action: null,
      message: null,
      attachments: [
        {
          mediaId: "wamid_artwork_doc_101",
          filename: "nawaz_business_card_artwork.pdf",
          mimeType: "application/pdf",
          fileSize: 1048576,
        },
      ],
    };
    res = await salesBrain.execute(state);

    // Step 18: Prompts Finishing Options / Addons (or Review if no addons)
    if (res.currentStep === DecisionTypes.SELECT_ADDONS) {
      assert.ok(res.response.actions.some((a) => a.id === "NEXT_STEP"));
      state = {
        ...res,
        action: {
          id: "NEXT_STEP",
          payload: { step: "addons" },
        },
      };
      res = await salesBrain.execute(state);
    }

    // Step 19: Order Summary / Review Order
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);
    assert.ok(res.response.message.includes("Order Summary"));
    assert.ok(res.response.message.includes("Affordable Business Cards"));
    assert.ok(res.response.message.includes("200"));
    assert.ok(res.response.message.includes("Delivery (AED 25)"));
    assert.ok(res.response.message.includes("101 Business Bay, Dubai"));
    assert.ok(res.response.message.includes("Artwork"));
    assert.ok(res.response.message.includes("nawaz_business_card_artwork.pdf"));
    assert.ok(res.response.actions.some((a) => a.id === "CONFIRM_ORDER"));
    assert.ok(res.response.actions.some((a) => a.id === "EDIT_ORDER"));
    assert.ok(res.response.actions.some((a) => a.id === "CANCEL_ORDER"));

    // Step 20: Customer clicks Confirm Order -> Transitions to COLLECT_CUSTOMER
    state = {
      ...res,
      action: {
        id: "CONFIRM_ORDER",
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.ok(res.response.message.includes("enter your full name"));

    // Step 21: Customer provides Name: "Nawaz Gadiwale"
    state = {
      ...res,
      action: {
        id: "SET_CUSTOMER_FIELD",
        payload: { fieldId: "name", value: "Nawaz Gadiwale" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.ok(res.response.message.includes("Thanks, Nawaz!"));
    assert.ok(res.response.message.includes("enter your email address"));

    // Step 22: Customer provides Email: "nawaz@example.com"
    state = {
      ...res,
      action: {
        id: "SET_CUSTOMER_FIELD",
        payload: { fieldId: "email", value: "nawaz@example.com" },
      },
    };
    res = await salesBrain.execute(state);
    assert.equal(res.currentStep, "COLLECT_CUSTOMER");
    assert.ok(res.response.message.includes("Company name is optional"));

    // Step 23: Customer skips Company -> ORDER_COMPLETED
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
    assert.equal(res.liveRequirement.customer.name, "Nawaz Gadiwale");
    assert.equal(res.liveRequirement.customer.email, "nawaz@example.com");
    assert.equal(res.liveRequirement.customer.phone, phoneNumber);
  });

  // =========================================================================
  // 2. STORE PICKUP FLOW (Address is SKIPPED; Delivery Fee = AED 0)
  // =========================================================================
  await t.test("2. Store Pickup Flow: skips address and sets fee to AED 0", async () => {
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);

    // Multi-answer message: quantity, names, material, lamination, and PICKUP
    state = {
      ...res,
      action: null,
      message: "500 cards, 1 name, 350gsm matt, no lamination, store pickup",
    };
    res = await salesBrain.execute(state);

    // Because pickup was chosen:
    // Address step MUST be skipped!
    assert.notEqual(res.currentStep, DecisionTypes.DELIVERY_ADDRESS);

    // Send artwork
    state = {
      ...res,
      attachments: [
        {
          mediaId: "art_pickup_1",
          filename: "pickup_card.pdf",
          mimeType: "application/pdf",
        },
      ],
    };
    res = await salesBrain.execute(state);

    if (res.currentStep === DecisionTypes.SELECT_ADDONS) {
      state = {
        ...res,
        action: { id: "NEXT_STEP", payload: { step: "addons" } },
      };
      res = await salesBrain.execute(state);
    }

    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);
    assert.ok(res.response.message.includes("Store Pickup (Free)"));
    assert.ok(!res.response.message.includes("Delivery (AED 25)"));
    assert.ok(!res.response.message.includes("Delivery Address:"));
  });

  // =========================================================================
  // 3. ARTWORK: DESIGN ASSISTANCE ALTERNATIVE ("need design")
  // =========================================================================
  await t.test("3. Artwork step: customer requesting design assistance succeeds without blocking", async () => {
    let state = {
      action: { id: "ORDER_NOW", payload: { productId: "affordable" } },
    };
    let res = await salesBrain.execute(state);

    state = {
      ...res,
      action: null,
      message: "200 cards, 1 name, 350gsm matt, no lamination, self pickup",
    };
    res = await salesBrain.execute(state);

    // Prompt is for artwork
    assert.equal(res.currentStep, DecisionTypes.ARTWORK);

    // Customer says they need help with design
    state = {
      ...res,
      action: null,
      message: "I do not have artwork, please help with the design",
    };
    res = await salesBrain.execute(state);

    if (res.currentStep === DecisionTypes.SELECT_ADDONS) {
      state = {
        ...res,
        action: { id: "NEXT_STEP", payload: { step: "addons" } },
      };
      res = await salesBrain.execute(state);
    }

    // Successfully transitioned to REVIEW_ORDER without getting stuck
    assert.equal(res.currentStep, DecisionTypes.REVIEW_ORDER);
    assert.ok(res.response.message.includes("Design assistance requested"));
  });

  // =========================================================================
  // 4. DATE PARSING VALIDATION
  // =========================================================================
  await t.test("4. Date parsing handles Tomorrow, Named Month, ISO, DD/MM/YYYY, Day Names", () => {
    const today = new Date();

    // Tomorrow
    const tomorrowResult = extractor.resolveDeliveryDate("I want it tomorrow please", today);
    const expectedTomorrow = new Date(today);
    expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
    const expectedTomorrowStr = `${expectedTomorrow.getFullYear()}-${String(
      expectedTomorrow.getMonth() + 1,
    ).padStart(2, "0")}-${String(expectedTomorrow.getDate()).padStart(2, "0")}`;
    assert.equal(tomorrowResult, expectedTomorrowStr);

    // Named month: 15 September
    const sepResult1 = extractor.resolveDeliveryDate("Need it by 15 September", today);
    assert.ok(sepResult1.endsWith("-09-15"));

    // Named month: September 15
    const sepResult2 = extractor.resolveDeliveryDate("deliver on September 15th", today);
    assert.ok(sepResult2.endsWith("-09-15"));

    // Day of week: Monday
    const mondayResult = extractor.resolveDeliveryDate("Deliver by Monday", today);
    assert.match(mondayResult, /^\d{4}-\d{2}-\d{2}$/);

    // Explicit date: DD/MM/YYYY
    const explicitResult = extractor.resolveDeliveryDate("18/10/2026", today);
    assert.equal(explicitResult, "2026-10-18");
  });

  // =========================================================================
  // 5. CANCELLATION AT EVERY STEP (HIGHEST PRIORITY GLOBAL INTERRUPT)
  // =========================================================================
  await t.test("5. Comprehensive Cancellation tests at EVERY step with exact logs and zero media", async () => {
    const cancelTriggers = [
      "cancel",
      "Cancel",
      "CANCEL",
      "cancel order",
      "I want to cancel",
      "please cancel",
      { id: "CANCEL_ORDER" },
    ];

    const testSteps = [
      {
        name: "at Greeting",
        state: { workflow: "GREETING", currentStep: "GREETING" },
      },
      {
        name: "at SELECT_PRODUCT",
        state: { workflow: "SALES", currentStep: "SELECT_PRODUCT" },
      },
      {
        name: "at SELECT_SELECTION",
        state: {
          workflow: "SALES",
          currentStep: "SELECT_SELECTION",
          liveRequirement: {
            items: [{ product: { id: "business-cards" } }],
          },
        },
      },
      {
        name: "at SELECT_NESTED_PRODUCT",
        state: {
          workflow: "SALES",
          currentStep: "SELECT_NESTED_PRODUCT",
          liveRequirement: {
            items: [{ product: { id: "business-cards" }, selection: { id: "budget-friendly" } }],
          },
        },
      },
      {
        name: "at PRODUCT_DETAILS",
        state: {
          workflow: "SALES",
          currentStep: "PRODUCT_DETAILS",
          liveRequirement: {
            items: [{ product: { id: "affordable" } }],
          },
        },
      },
      {
        name: "at COLLECT_PRODUCT_FIELD (quantity)",
        state: {
          workflow: "SALES",
          currentStep: "COLLECT_PRODUCT_FIELD",
          liveRequirement: {
            items: [{ product: { id: "affordable" }, orderStarted: true }],
          },
        },
      },
      {
        name: "at SELECT_DELIVERY_METHOD",
        state: {
          workflow: "SALES",
          currentStep: DecisionTypes.SELECT_DELIVERY_METHOD,
          liveRequirement: {
            items: [{ product: { id: "affordable" }, orderStarted: true, formData: { quantity: 200 } }],
          },
        },
      },
      {
        name: "at DELIVERY_ADDRESS",
        state: {
          workflow: "SALES",
          currentStep: DecisionTypes.DELIVERY_ADDRESS,
          liveRequirement: {
            items: [{ product: { id: "affordable" }, orderStarted: true, delivery: { method: "delivery" } }],
          },
        },
      },
      {
        name: "at DELIVERY_DATE",
        state: {
          workflow: "SALES",
          currentStep: DecisionTypes.DELIVERY_DATE,
          liveRequirement: {
            items: [
              {
                product: { id: "affordable" },
                orderStarted: true,
                delivery: { method: "delivery", address: "101 Business Bay" },
              },
            ],
          },
        },
      },
      {
        name: "at ARTWORK",
        state: {
          workflow: "SALES",
          currentStep: DecisionTypes.ARTWORK,
          liveRequirement: {
            items: [
              {
                product: { id: "affordable" },
                orderStarted: true,
                delivery: { method: "delivery", address: "101 Business Bay", requiredDate: "2026-09-15" },
              },
            ],
          },
        },
      },
      {
        name: "at REVIEW_ORDER",
        state: {
          workflow: "SALES",
          currentStep: DecisionTypes.REVIEW_ORDER,
          liveRequirement: {
            items: [
              {
                product: { id: "affordable" },
                orderStarted: true,
                formData: { quantity: 200 },
                delivery: { method: "delivery", address: "101 Business Bay" },
              },
            ],
          },
        },
      },
      {
        name: "at COLLECT_CUSTOMER (name)",
        state: {
          workflow: "SALES",
          currentStep: "COLLECT_CUSTOMER",
          liveRequirement: {
            items: [{ product: { id: "affordable" }, orderStarted: true, reviewCompleted: true }],
          },
        },
      },
      {
        name: "at COLLECT_CUSTOMER (email)",
        state: {
          workflow: "SALES",
          currentStep: "COLLECT_CUSTOMER",
          liveRequirement: {
            items: [{ product: { id: "affordable" }, orderStarted: true, reviewCompleted: true }],
            customer: { name: "Nawaz" },
          },
        },
      },
    ];

    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      const trigger = cancelTriggers[i % cancelTriggers.length];

      const inputState = {
        ...step.state,
        whatsapp: { phoneNumber: "918310412768" },
        ...(typeof trigger === "string" ? { message: trigger } : { action: trigger }),
      };

      const spy = spyLogs();
      const res = await salesBrain.execute(inputState);

      // Verify SalesBrain state reset
      assert.equal(res.workflow, "NONE", `Workflow must be NONE when cancelled ${step.name}`);
      assert.equal(res.currentStep, null, `currentStep must be null when cancelled ${step.name}`);
      assert.equal(res.completed, false);
      assert.equal(res.confirmed, false);
      assert.ok(
        !res.liveRequirement?.items || res.liveRequirement.items.length === 0,
        `Items must be empty when cancelled ${step.name}`,
      );
      assert.ok(
        res.response.message.includes("Your current order has been cancelled."),
        `Cancellation message must be present ${step.name}`,
      );
      assert.ok(
        res.response.message.includes("What would you like to order?"),
        `Catalog prompt must be present ${step.name}`,
      );

      // Verify strict media block via response adapter
      const media = responseAdapter.extractProductImage(res);
      assert.equal(media, null, `Product media must be null on cancel ${step.name}`);

      const waMessages = responseAdapter.toWhatsAppMessages(res);
      assert.ok(
        !waMessages.some((m) => m.type === "image"),
        `No image message must be produced on cancel ${step.name}`,
      );

      // Simulate WhatsAppService.sendResult to verify outbound cancellation logging
      const dummyService = new WhatsAppService();
      // Stub sendMessage to avoid network calls
      dummyService.sendMessage = async () => ({ success: true });
      await dummyService.sendResult(
        { whatsapp: { phoneNumber: "918310412768" }, sessionId: "whatsapp:test" },
        res,
      );

      const logs = spy.getLogs();
      spy.restore();

      // Verify all 5 required cancellation logs in order:
      // 1. [CANCEL][Detected]
      // 2. [CANCEL][Action] action=CANCEL_ORDER
      // 3. [CANCEL][STATE_RESET] workflow=NONE currentStep=null
      // 4. [CANCEL][MEDIA_BLOCKED]
      // 5. [CANCEL][OUTBOUND]
      const detectedIdx = logs.findIndex((l) => l.includes("[CANCEL][Detected]"));
      const actionIdx = logs.findIndex((l) => l.includes("[CANCEL][Action] action=CANCEL_ORDER"));
      const resetIdx = logs.findIndex((l) => l.includes("[CANCEL][STATE_RESET] workflow=NONE currentStep=null"));
      const mediaBlockedIdx = logs.findIndex((l) => l.includes("[CANCEL][MEDIA_BLOCKED]"));
      const outboundIdx = logs.findIndex((l) => l.includes("[CANCEL][OUTBOUND]"));

      assert.ok(detectedIdx >= 0, `[CANCEL][Detected] logged ${step.name}`);
      assert.ok(actionIdx > detectedIdx, `[CANCEL][Action] logged after Detected ${step.name}`);
      assert.ok(resetIdx > actionIdx, `[CANCEL][STATE_RESET] logged after Action ${step.name}`);
      assert.ok(mediaBlockedIdx > resetIdx, `[CANCEL][MEDIA_BLOCKED] logged after STATE_RESET ${step.name}`);
      assert.ok(outboundIdx > mediaBlockedIdx, `[CANCEL][OUTBOUND] logged after MEDIA_BLOCKED ${step.name}`);
    }
  });

  // =========================================================================
  // 6. EDIT ORDER CLEARS REVIEW & CONFIRM BUT PRESERVES EXISTING DATA
  // =========================================================================
  await t.test("6. EDIT_ORDER clears review/confirm state but preserves all completed values", async () => {
    let state = {
      currentStep: DecisionTypes.REVIEW_ORDER,
      liveRequirement: {
        items: [
          {
            product: { id: "affordable", name: "Affordable Business Cards" },
            orderStarted: true,
            reviewCompleted: true,
            confirmClicked: true,
            formData: {
              quantity: 500,
              numberOfNames: 2,
              material: "350gsm Art Matt",
              lamination: "none",
            },
            delivery: {
              method: "delivery",
              address: "101 Business Bay, Dubai",
              requiredDate: "2026-09-15",
            },
            artwork: {
              received: true,
              fileName: "card.pdf",
            },
          },
        ],
      },
      action: { id: "EDIT_ORDER" },
    };

    const res = await salesBrain.execute(state);

    // Must return to catalog/field editing
    assert.notEqual(res.currentStep, DecisionTypes.REVIEW_ORDER);
    const item = res.liveRequirement.items[0];
    assert.equal(item.reviewCompleted, false);
    assert.equal(item.confirmClicked, false);

    // Existing data MUST NOT be wiped
    assert.equal(item.formData.quantity, 500);
    assert.equal(item.formData.numberOfNames, 2);
    assert.equal(item.delivery.address, "101 Business Bay, Dubai");
    assert.equal(item.artwork.fileName, "card.pdf");
  });
});
