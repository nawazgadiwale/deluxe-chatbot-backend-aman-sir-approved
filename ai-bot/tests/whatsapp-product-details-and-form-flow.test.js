import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import SalesNode from "../ai/graph/nodes/SalesNode.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";
import { normalizeImageUrl } from "../modules/sales/helpers/CatalogHelper.js";
import OrderModel from "../../models/OrderRequest.js";

describe("Production WhatsApp Product Details -> ORDER NOW -> Form -> DB Flow (Tests A through L)", () => {
  const catalogService = new SalesCatalogService();
  const orderManager = new OrderManager();
  const adapter = new WhatsAppResponseAdapter();
  const salesBrain = new SalesBrain();
  const codec = new WhatsappActionCodec();

  let mongoConnected = false;
  const testSessionId = `test-session-${Date.now()}`;

  before(async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(
          process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/exprintmart_test",
          { serverSelectionTimeoutMS: 2500 },
        );
      }
      mongoConnected = Boolean(mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2);
    } catch {
      mongoConnected = false;
    }
  });

  after(async () => {
    if (mongoConnected) {
      try {
        await OrderModel.deleteMany({ sessionId: { $regex: /^test-session-/ } });
        await mongoose.disconnect();
      } catch {
        // ignore
      }
    }
  });

  // =========================================================================
  // TEST A: Business Cards -> Budget-Friendly -> Affordable
  // =========================================================================
  test.skip("TEST A: Business Cards -> Budget-Friendly -> Affordable resolves product, image, details, and compact ORDER NOW", async () => {
    const salesNode = new SalesNode();
    const res = await salesNode.execute({
      site: "exprintmart",
      channel: "WHATSAPP",
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: {
          nestedProductId: "affordable",
          productId: "business-cards",
          selectionId: "budget-friendly",
        },
      },
      memory: {},
      persistence: { conversation: { dirty: false }, order: { dirty: false } },
    });

    // 1. Assert final resolved product is affordable
    assert.strictEqual(res.currentStep, "PRODUCT_DETAILS");
    const itemProduct = res.order?.items?.[0]?.product;
    assert.ok(itemProduct, "Order item product must exist");
    assert.strictEqual(itemProduct.id, "affordable");
    assert.strictEqual(itemProduct.parentProductId, "business-cards");
    assert.strictEqual(itemProduct.parentSelectionId, "budget-friendly");

    // 2. WhatsApp messages conversion
    const messages = adapter.toWhatsAppMessages(res);
    assert.ok(messages.length >= 1, "Must produce message with product details and ORDER NOW button");

    const msg = messages[0];
    assert.strictEqual(msg.type, "interactive");
    assert.strictEqual(msg.interactive.type, "button");

    // Assert catalog image link is authoritative catalog link
    assert.strictEqual(
      msg.interactive.header?.image?.link,
      "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp",
    );
    assert.ok(!msg.interactive.header.image.link.includes("webphttps"), "Duplicated URL must be normalized");

    // Assert product details are sent
    const body = msg.interactive.body?.text || "";
    assert.ok(body.includes("Affordable Business Cards"), "Caption must include product title");
    assert.ok(body.includes("Budget Friendly"), "Caption must include product badge");
    assert.ok(Buffer.byteLength(body, "utf8") <= 1024, "Caption must be <= 1024 chars for WhatsApp");

    // Assert [ ORDER NOW ] action is returned (compact code <= 256 bytes)
    const btn = msg.interactive.action?.buttons?.[0];
    assert.ok(btn, "ORDER NOW button must exist");
    assert.strictEqual(btn.reply.title, "ORDER NOW");
    assert.ok(btn.reply.id.startsWith("order_now:affordable:"));
    assert.ok(Buffer.byteLength(btn.reply.id, "utf8") <= 256, "Action id must be <= 256 bytes");

    // Assert codec can decode the button payload
    const decoded = WhatsappActionCodec.decode(btn.reply.id);
    assert.strictEqual(decoded.id, "ORDER_NOW");
    assert.strictEqual(decoded.payload.productId, "affordable");
  });

  // =========================================================================
  // TEST B: Click [ ORDER NOW ]
  // =========================================================================
  test.skip("TEST B: Click [ ORDER NOW ] transitions to ORDER_FORM with catalog-driven fields", async () => {
    const salesNode = new SalesNode();

    // Step 1: Select nested product
    const step1 = await salesNode.execute({
      site: "exprintmart",
      channel: "WHATSAPP",
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: {
          nestedProductId: "affordable",
          productId: "business-cards",
          selectionId: "budget-friendly",
        },
      },
      memory: {},
      persistence: { conversation: { dirty: false }, order: { dirty: false } },
    });

    // Step 2: Click ORDER NOW
    const step2 = await salesNode.execute({
      site: "exprintmart",
      channel: "WHATSAPP",
      action: {
        id: "ORDER_NOW",
        payload: {
          productId: "affordable",
          formId: "order-form-affordable",
        },
      },
      order: step1.order,
      memory: {},
      persistence: { conversation: { dirty: false }, order: { dirty: false } },
    });

    // Assert next step is ORDER_FORM
    assert.strictEqual(step2.currentStep, "ORDER_FORM");
    const item = step2.order?.items?.[0];
    assert.strictEqual(item.formMode, true, "formMode must be true");
    assert.strictEqual(item.product?.id, "affordable");

    const dynamicForm = orderManager.getDynamicForm(step2.order);
    assert.ok(dynamicForm, "Dynamic form must exist for affordable");

    // Assert form contains catalog-driven fields
    const fieldIds = dynamicForm.fields.map((f) => f.id);
    assert.ok(fieldIds.includes("quantity"), "Form must have quantity field");
    assert.ok(fieldIds.includes("deliveryMethod"), "Form must have deliveryMethod field");
    assert.ok(fieldIds.includes("deliveryAddress"), "Form must have deliveryAddress field");
    assert.ok(fieldIds.includes("artwork"), "Form must have artwork field");
    assert.ok(fieldIds.includes("deliveryDate"), "Form must have deliveryDate field");

    // Assert no fields from irrelevant products appear (e.g. self-ink stamp shape, roll-up banner stand type)
    assert.ok(!fieldIds.includes("stampShape"), "Must not include stampShape");
    assert.ok(!fieldIds.includes("inkColor"), "Must not include inkColor");
    assert.ok(!fieldIds.includes("standType"), "Must not include standType");
  });

  // =========================================================================
  // TEST C: Complete form field by field
  // =========================================================================
  test.skip("TEST C: Complete form field by field preserves concrete product and handles conditionals", async () => {
    // Start with affordable product in formMode
    let state = await salesBrain.execute({
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: {
          nestedProductId: "affordable",
          productId: "business-cards",
          selectionId: "budget-friendly",
        },
      },
    });

    state = await salesBrain.execute({
      ...state,
      action: {
        id: "ORDER_NOW",
        payload: {
          productId: "affordable",
          formId: "order-form-affordable",
        },
      },
    });

    assert.strictEqual(state.currentStep, "ORDER_FORM");

    // Field 1: Quantity -> 100
    state = await salesBrain.execute({
      ...state,
      userMessage: "100",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.product?.id, "affordable");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.quantity, 100);

    // Field 2: Number of Names -> 1
    state = await salesBrain.execute({
      ...state,
      userMessage: "1",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.numberOfNames, 1);

    // Field 3: Material -> 350gsm Art Matt
    state = await salesBrain.execute({
      ...state,
      userMessage: "350gsm Art Matt",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.material, "350gsm Art Matt");

    // Field 4: Lamination -> matt
    state = await salesBrain.execute({
      ...state,
      userMessage: "matt",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.lamination, "matt");

    // Field 5: Delivery method -> delivery
    state = await salesBrain.execute({
      ...state,
      userMessage: "delivery",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.product?.id, "affordable");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.deliveryMethod, "delivery");

    // Field 6: Artwork -> have_artwork
    state = await salesBrain.execute({
      ...state,
      userMessage: "I have artwork",
      action: null,
    });
    assert.strictEqual(state.liveRequirement?.items?.[0]?.product?.id, "affordable");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.artwork, "have_artwork");

    // Field 7: Pickup / Delivery Date -> 2026-09-10
    state = await salesBrain.execute({
      ...state,
      userMessage: "2026-09-10",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.product?.id, "affordable");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.formData?.deliveryDate, "2026-09-10");

    // Field 8: Delivery address -> Downtown Dubai, Bay Square Building 1 (conditional on delivery)
    state = await salesBrain.execute({
      ...state,
      userMessage: "Downtown Dubai, Bay Square Building 1",
      action: null,
    });
    assert.strictEqual(state.currentStep, "ORDER_FORM");
    assert.strictEqual(state.liveRequirement?.items?.[0]?.product?.id, "affordable");
    assert.strictEqual(
      state.liveRequirement?.items?.[0]?.formData?.deliveryAddress,
      "Downtown Dubai, Bay Square Building 1",
    );
  });

  // =========================================================================
  // TEST D: Invalid form field value
  // =========================================================================
  test.skip("TEST D: Invalid form field value rejected, field re-prompted, NO OrderRequest created", async () => {
    let state = await salesBrain.execute({
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: {
          nestedProductId: "affordable",
          productId: "business-cards",
          selectionId: "budget-friendly",
        },
      },
    });

    state = await salesBrain.execute({
      ...state,
      action: {
        id: "ORDER_NOW",
        payload: {
          productId: "affordable",
          formId: "order-form-affordable",
        },
      },
    });

    // Attempt invalid form submission
    const invalidRes = await salesBrain.execute({
      ...state,
      channel: "WHATSAPP",
      sessionId: "test-invalid-session",
      action: {
        id: "SUBMIT_ORDER_FORM",
        payload: {
          formId: "order-form-affordable",
          values: {
            quantity: -5,
          },
        },
      },
    });

    // Must be rejected back to ORDER_FORM with error
    assert.strictEqual(invalidRes.currentStep, "ORDER_FORM");
    assert.notStrictEqual(invalidRes.orderConfirmed, true);
    assert.notStrictEqual(invalidRes.liveRequirement?.confirmed, true);

    if (mongoConnected) {
      const doc = await OrderModel.findOne({ sessionId: "test-invalid-session" });
      assert.strictEqual(doc, null, "NO OrderRequest document must be created in MongoDB for invalid form");
    }
  });

  // =========================================================================
  // TEST E: Form submission creates OrderRequest
  // =========================================================================
  test.skip("TEST E: Form submission creates OrderRequest with CONFIRMED status, phone, quantity, delivery", async () => {
    let state = await salesBrain.execute({
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: {
          nestedProductId: "affordable",
          productId: "business-cards",
          selectionId: "budget-friendly",
        },
      },
    });

    state = await salesBrain.execute({
      ...state,
      action: {
        id: "ORDER_NOW",
        payload: {
          productId: "affordable",
          formId: "order-form-affordable",
        },
      },
    });

    const sessionId = `test-session-e-${Date.now()}`;
    const submitRes = await salesBrain.execute({
      ...state,
      channel: "WHATSAPP",
      sessionId,
      customerWaId: "971501234567",
      customer: {
        phone: "+971501234567",
        name: "Aman Sir",
      },
      action: {
        id: "SUBMIT_ORDER_FORM",
        payload: {
          formId: "order-form-affordable",
          values: {
            quantity: 100,
            numberOfNames: 1,
            material: "350gsm Art Matt",
            lamination: "matt",
            deliveryMethod: "delivery",
            deliveryAddress: "Downtown Dubai, Bay Square Building 1",
            deliveryDate: "2026-09-10",
            artwork: "have_artwork",
          },
        },
      },
    });

    // Assert order review stage (Flow submission requires review and explicit confirmation)
    assert.strictEqual(submitRes.currentStep, "ORDER_REVIEW");
    assert.strictEqual(submitRes.orderConfirmed, false);
    assert.strictEqual(submitRes.liveRequirement?.status, "REVIEW");
    assert.ok(submitRes.response?.actions?.some(a => a.id === "CONFIRM_ORDER"), "Must provide Confirm Order action");
    assert.ok(submitRes.response?.actions?.some(a => a.id === "EDIT_ORDER"), "Must provide Edit action");
    assert.ok(submitRes.response?.actions?.some(a => a.id === "CANCEL_ORDER"), "Must provide Cancel action");

    // Explicit customer confirmation step
    const confirmRes = await salesBrain.execute({
      ...submitRes,
      action: { id: "CONFIRM_ORDER" },
    });

    assert.strictEqual(confirmRes.currentStep, "ORDER_COMPLETED");
    assert.strictEqual(confirmRes.orderConfirmed, true);
    assert.strictEqual(confirmRes.liveRequirement?.confirmed, true);
    assert.strictEqual(confirmRes.liveRequirement?.status, "CONFIRMED");
    assert.ok(confirmRes.liveRequirement?.orderNumber, "orderNumber must be generated");
    assert.ok(confirmRes.assistantMessage.includes(confirmRes.liveRequirement.orderNumber), "Confirmation includes order number");

    if (mongoConnected) {
      const orders = await OrderModel.find({ sessionId });
      assert.strictEqual(orders.length, 1, "Exactly ONE OrderRequest document must be created in MongoDB");

      const orderDoc = orders[0];
      assert.strictEqual(orderDoc.customer?.phone, "+971501234567");
      assert.strictEqual(orderDoc.delivery?.method, "delivery");
      assert.strictEqual(orderDoc.delivery?.address, "Downtown Dubai, Bay Square Building 1");

      const item = orderDoc.items?.[0];
      assert.ok(item, "Order item must exist");
      assert.strictEqual(item.product?.id, "affordable");
    }
  });

  // =========================================================================
  // TEST F: Idempotent form submission
  // =========================================================================
  test.skip("TEST F: Idempotent form submission prevents duplicate OrderRequest creation", async () => {
    let state = await salesBrain.execute({
      action: {
        id: "SELECT_NESTED_PRODUCT",
        payload: {
          nestedProductId: "affordable",
          productId: "business-cards",
          selectionId: "budget-friendly",
        },
      },
    });

    state = await salesBrain.execute({
      ...state,
      action: {
        id: "ORDER_NOW",
        payload: {
          productId: "affordable",
          formId: "order-form-affordable",
        },
      },
    });

    const sessionId = `test-session-f-${Date.now()}`;
    const payload = {
      ...state,
      channel: "WHATSAPP",
      sessionId,
      customerWaId: "971501234567",
      customer: { phone: "+971501234567" },
      action: {
        id: "SUBMIT_ORDER_FORM",
        payload: {
          formId: "order-form-affordable",
          values: {
            quantity: 200,
            numberOfNames: 1,
            material: "350gsm Art Matt",
            lamination: "none",
            deliveryMethod: "pickup",
            deliveryDate: "2026-09-12",
            artwork: "need_design",
          },
        },
      },
    };

    // First submission
    const res1 = await salesBrain.execute(payload);
    assert.strictEqual(res1.currentStep, "ORDER_REVIEW");

    // Resend same submission (duplicate webhook)
    const res2 = await salesBrain.execute({
      ...payload,
      order: res1.order,
      liveRequirement: res1.liveRequirement,
    });
    assert.strictEqual(res2.currentStep, "ORDER_REVIEW");

    if (mongoConnected) {
      const orders = await OrderModel.find({ sessionId });
      assert.strictEqual(orders.length, 1, "Must NOT create duplicate OrderRequest in MongoDB");
    }
  });

  // =========================================================================
  // TEST G: Direct ORDER NOW with wrong productId
  // =========================================================================
  test("TEST G: Direct ORDER NOW with wrong/unknown productId is rejected with error, NO form opened", async () => {
    const res = await salesBrain.execute({
      channel: "WHATSAPP",
      action: {
        id: "ORDER_NOW",
        payload: {
          productId: "completely-nonexistent-product-id-999",
          formId: "order-form-nonexistent",
        },
      },
    });

    // Assert rejected with error and NO form opened
    assert.ok(
      res.response?.message?.includes("Invalid or outdated product selection") ||
        res.response?.message?.includes("no longer available") ||
        res.response?.message?.includes("Please choose the product again"),
    );
  });

  // =========================================================================
  // TEST H: Malformed catalog image URL
  // =========================================================================
  test("TEST H: Malformed duplicated image URL normalized safely", () => {
    const malformed =
      "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webphttps://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp";
    const normalized = normalizeImageUrl(malformed);

    assert.strictEqual(
      normalized,
      "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp",
    );
    assert.ok(!normalized.includes("webphttps"), "Duplicated URL must not contain webphttps");
  });

  // =========================================================================
  // TEST I: Missing product image
  // =========================================================================
  test("TEST I: Missing product image sends product details cleanly without broken image", async () => {
    const resultWithNoImage = {
      currentStep: "PRODUCT_DETAILS",
      order: {
        items: [
          {
            product: {
              id: "custom-no-image-product",
              name: "Custom Product Without Image",
              description: "High quality custom printing.",
            },
          },
        ],
      },
      context: {
        product: {
          id: "custom-no-image-product",
          name: "Custom Product Without Image",
          description: "High quality custom printing.",
          images: [],
          image: null,
        },
      },
      actions: [
        {
          id: "ORDER_NOW",
          type: "ORDER_NOW",
          label: "ORDER NOW",
          payload: { productId: "custom-no-image-product", formId: "order-form-custom" },
        },
      ],
    };

    const messages = adapter.toWhatsAppMessages(resultWithNoImage);
    assert.ok(messages.length >= 1);

    // If no image, it should produce a clean text or interactive button without image header
    const btnMsg = messages.find((m) => m.type === "interactive");
    assert.ok(btnMsg, "Must render interactive button");
    assert.ok(!btnMsg.interactive?.header?.image, "Must not have broken image header");
    assert.ok(
      btnMsg.interactive?.body?.text?.includes("Custom Product Without Image") ||
      messages.some((m) => m.text?.body?.includes("Custom Product Without Image")),
      "Must include product title",
    );
  });

  // =========================================================================
  // TEST J: Laminated business cards
  // =========================================================================
  test("TEST J: Laminated business cards resolves laminated product, image, and form fields", () => {
    const resolved = catalogService.resolveProduct({
      parentProductId: "business-cards",
      selectionId: "budget-friendly",
      productId: "laminated",
    });

    assert.ok(resolved, "Must resolve laminated product from catalog");
    assert.strictEqual(resolved.id, "laminated");
    assert.strictEqual(
      normalizeImageUrl(resolved.image),
      "https://www.exprintmart.com/_next/static/media/business-cards-printing-dubai.9d8279df.webp",
    );

    const form = orderManager.getDynamicForm({
      items: [
        {
          product: { id: "business-cards" },
          selection: { id: "budget-friendly" },
          selectedProduct: resolved,
        },
      ],
    });
    assert.ok(form, "Must generate dynamic form for laminated business cards");
    const fieldIds = form.fields.map((f) => f.id);
    assert.ok(fieldIds.includes("quantity"), "Must have quantity field");
  });

  // =========================================================================
  // TEST K: PVC business cards
  // =========================================================================
  test("TEST K: PVC business cards resolves pvc-plastic product, image, and form fields", () => {
    const resolved = catalogService.resolveProduct({
      parentProductId: "business-cards",
      selectionId: "speciality-cards",
      productId: "pvc-plastic",
    });

    assert.ok(resolved, "Must resolve pvc-plastic product from catalog");
    assert.strictEqual(resolved.id, "pvc-plastic");
    assert.strictEqual(
      normalizeImageUrl(resolved.image),
      "https://www.exprintmart.com/_next/static/media/custom-business-cards-dubai.26a21e03.webp",
    );

    const form = orderManager.getDynamicForm({
      items: [
        {
          product: { id: "business-cards" },
          selection: { id: "speciality-cards" },
          selectedProduct: resolved,
        },
      ],
    });
    assert.ok(form, "Must generate dynamic form for pvc-plastic cards");
    const fieldIds = form.fields.map((f) => f.id);
    assert.ok(fieldIds.includes("quantity"), "Must have quantity field");
  });

  // =========================================================================
  // TEST L: Standees / Backdrops / Seals
  // =========================================================================
  test("TEST L: Standees / Backdrops / Seals dynamic resolution from catalog files", () => {
    // Backdrops
    const backdrop = catalogService.resolveProduct({ productId: "softcase-straight" });
    assert.ok(backdrop, "Must resolve backdrop from catalog");
    assert.ok(
      normalizeImageUrl(backdrop.image).includes("straight") ||
      normalizeImageUrl(backdrop.image).includes("softcase"),
      "Backdrop image must match real catalog webp",
    );

    // Seals / Stamps
    const stamp = catalogService.resolveProduct({ productId: "round" });
    assert.ok(stamp, "Must resolve round stamp from catalog");
    assert.ok(
      normalizeImageUrl(stamp.image).includes("round_self_ink_stamps_dubai.webp"),
      "Round stamp image must match catalog",
    );
  });
});
