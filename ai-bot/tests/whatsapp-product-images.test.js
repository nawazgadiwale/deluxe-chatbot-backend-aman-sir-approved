import test from "node:test";
import assert from "node:assert/strict";

import WhatsAppResponseAdapter, {
  normalizeImageUrl,
  resolveCatalogImage,
  BRAND_GREETING_LOGO_URL,
} from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import MetaProviderAdapter from "../modules/whatsapp/providers/MetaProviderAdapter.js";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import ConversationDecisionService from "../modules/sales/services/ConversationDecisionService.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesNode from "../ai/graph/nodes/SalesNode.js";
import GreetingNode from "../ai/graph/nodes/GreetingNode.js";

// =========================================================
// 1. PRODUCT A GETS PRODUCT A IMAGE
// =========================================================
test("1. Product A gets Product A image (Stamps -> self_ink_stamps_dubai.webp)", async () => {
  const salesNode = new SalesNode();
  const result = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    userMessage: "I want stamps",
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  assert.strictEqual(result.workflow, "SALES");
  assert.strictEqual(result.currentStep, "SELECT_SELECTION");

  const adapter = new WhatsAppResponseAdapter();
  const image = adapter.extractProductImage(result);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
});

// =========================================================
// 2. PRODUCT B GETS PRODUCT B IMAGE
// =========================================================
test("2. Product B gets Product B image (Business Cards -> standard_business_cards_printing_dubai.webp)", async () => {
  const salesNode = new SalesNode();
  const result = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    userMessage: "I want business cards",
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  assert.strictEqual(result.workflow, "SALES");
  assert.strictEqual(result.currentStep, "SELECT_SELECTION");

  const adapter = new WhatsAppResponseAdapter();
  const image = adapter.extractProductImage(result);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/digital-business-cards/standard_business_cards_printing_dubai.webp",
  );
});

// =========================================================
// 3. PRODUCT A NEVER GETS PRODUCT B IMAGE
// =========================================================
test("3. Product A never gets Product B image", () => {
  const adapter = new WhatsAppResponseAdapter();
  const stampResult = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    context: {
      product: {
        id: "self-ink-stamps",
        name: "Self Ink Stamps",
        image: "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
      },
    },
  };

  const image = adapter.extractProductImage(stampResult);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
  assert.ok(!image.includes("business-cards"));
  assert.ok(!image.includes("banner"));
});

// =========================================================
// 4. CATEGORY IMAGE ONLY WHEN CATEGORY OWNS IMAGE
// =========================================================
test("4. Category image is used only when category owns the image (Pop Up Display Stands parent has no image -> null)", async () => {
  const salesNode = new SalesNode();
  const result = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    userMessage: "I want pop up display stands",
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  assert.strictEqual(result.workflow, "SALES");
  assert.strictEqual(result.currentStep, "SELECT_SELECTION");

  const adapter = new WhatsAppResponseAdapter();
  const image = adapter.extractProductImage(result);
  // The parent 'pop-up-display-stands' in backdrops.json has no image.
  // It must return null and NOT fall back to an unrelated product image.
  assert.strictEqual(image, null);

  const messages = adapter.toWhatsAppMessages(result);
  assert.ok(messages.length > 0);
  const imageMsg = messages.find((m) => m.type === "image");
  assert.strictEqual(imageMsg, undefined);
  const interactiveMsg = messages.find((m) => m.type === "interactive");
  assert.ok(interactiveMsg);
});

// =========================================================
// 5. NESTED PRODUCT GETS ITS OWN IMAGE
// =========================================================
test("5. Nested product gets its own image (Pop Up Softcase - Straight)", () => {
  const adapter = new WhatsAppResponseAdapter();
  const result = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    context: {
      selectedProduct: {
        id: "softcase-straight",
        name: "Pop Up Softcase - Straight",
        images: "https://www.dlxprint.com/images/backdrops&exhibition/softcase_straight_popup_banner_printing_dubai.webp",
      },
    },
  };

  const image = adapter.extractProductImage(result);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/backdrops&exhibition/softcase_straight_popup_banner_printing_dubai.webp",
  );
});

// =========================================================
// 6. MISSING IMAGE RESULTS IN TEXT/BUTTON FALLBACK
// =========================================================
test("6. Missing image results in clean text/button fallback without error", () => {
  const adapter = new WhatsAppResponseAdapter();
  const result = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    context: {
      product: {
        id: "custom-product",
        name: "Custom Print Item",
        image: null,
      },
    },
    actions: [
      { id: "SELECT_SELECTION", label: "Option A", payload: { selectionId: "a" } },
      { id: "SELECT_SELECTION", label: "Option B", payload: { selectionId: "b" } },
    ],
    message: "Please select an option for Custom Print Item:",
  };

  const messages = adapter.toWhatsAppMessages(result);
  assert.ok(Array.isArray(messages) && messages.length === 1);
  assert.strictEqual(messages[0].type, "interactive");
  assert.strictEqual(messages[0].interactive.type, "button");
  assert.strictEqual(messages[0].interactive.header, undefined);
});

// =========================================================
// 7. INVALID IMAGE RESULTS IN FALLBACK
// =========================================================
test("7. Invalid image URL (localhost, javascript:, data:, private IP) results in fallback", () => {
  const adapter = new WhatsAppResponseAdapter();
  const dangerousResults = [
    { context: { product: { image: "javascript:alert(1)" } } },
    { context: { product: { image: "http://localhost:3000/bad.png" } } },
    { context: { product: { image: "https://127.0.0.1/bad.png" } } },
    { context: { product: { image: "http://192.168.1.100/bad.png" } } },
    { context: { product: { image: "data:image/png;base64,AAAA" } } },
  ];

  for (const res of dangerousResults) {
    assert.strictEqual(adapter.extractProductImage(res), null);
  }
});

// =========================================================
// 8. DUPLICATE MALFORMED URL IS NORMALIZED SAFELY
// =========================================================
test("8. Duplicate malformed URL is normalized safely", () => {
  const single = "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp";
  const duplicated = `${single}${single}`;
  const normalized = normalizeImageUrl(duplicated);
  assert.strictEqual(normalized, single);

  const resolved = resolveCatalogImage({ image: duplicated });
  assert.strictEqual(resolved, single);
});

// =========================================================
// 9. PREVIOUS WORKFLOW IMAGE DOES NOT LEAK INTO NEW WORKFLOW
// =========================================================
test("9. Previous workflow image does not leak into new workflow", async () => {
  const salesBrain = new SalesBrain();

  // Turn 1: Business Cards
  const state1 = await salesBrain.execute({
    userMessage: "I want business cards",
    currentStep: null,
  });

  // Turn 2: User interrupts and asks for Pop Up Display Stands
  const state2 = await salesBrain.execute({
    ...state1,
    userMessage: "I want pop up display stands",
    currentStep: state1.currentStep,
  });

  const adapter = new WhatsAppResponseAdapter();
  const image2 = adapter.extractProductImage(state2);

  // Must NOT be the business card image from Turn 1!
  assert.strictEqual(image2, null);
  assert.notStrictEqual(
    image2,
    "https://www.dlxprint.com/images/digital-business-cards/standard_business_cards_printing_dubai.webp",
  );
});

// =========================================================
// 10. MULTI-CUSTOMER ISOLATION
// =========================================================
test("10. Customer A image does not leak into Customer B", async () => {
  const salesNode = new SalesNode();

  // Customer A selects Stamps
  const resCustomerA = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    userMessage: "I want stamps",
    memory: {},
    phoneNumber: "971501111111",
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  // Customer B selects Pop Up Stands
  const resCustomerB = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    userMessage: "I want pop up display stands",
    memory: {},
    phoneNumber: "971502222222",
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  const adapter = new WhatsAppResponseAdapter();
  const imageA = adapter.extractProductImage(resCustomerA);
  const imageB = adapter.extractProductImage(resCustomerB);

  assert.strictEqual(
    imageA,
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
  assert.strictEqual(imageB, null);
});

// =========================================================
// 11. SELECT_PRODUCT PRESERVES CORRECT CATALOG IDENTITY
// =========================================================
test("11. SELECT_PRODUCT preserves correct catalog identity and image", async () => {
  const salesNode = new SalesNode();
  const result = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "self-ink-stamps" },
    },
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  assert.strictEqual(result.order.items[0].product.id, "self-ink-stamps");
  const adapter = new WhatsAppResponseAdapter();
  const image = adapter.extractProductImage(result);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
});

// =========================================================
// 12. SELECT_SELECTION PRESERVES CORRECT CATALOG IDENTITY
// =========================================================
test("12. SELECT_SELECTION preserves correct catalog identity and image", () => {
  const catalogService = new SalesCatalogService();
  const product = catalogService.getProduct("self-ink-stamps");
  const roundOption = catalogService.getSelectionOption(product, "round");
  const resolved = resolveCatalogImage(roundOption);
  assert.strictEqual(
    resolved,
    "https://www.dlxprint.com/images/print&marketing/round_self_ink_stamps_dubai.webp",
  );
});

// =========================================================
// 13. SELECT_NESTED_PRODUCT PRESERVES CORRECT CATALOG IDENTITY
// =========================================================
test("13. SELECT_NESTED_PRODUCT preserves correct catalog identity and image", () => {
  const decisionService = new ConversationDecisionService();
  const product = {
    id: "business-cards",
    name: "Business Cards",
    selection: { id: "luxury", label: "Luxury Cards" },
  };
  const selection = {
    id: "luxury",
    name: "Luxury Cards",
    image: "https://www.exprintmart.com/_next/static/media/custom-business-cards-dubai.26a21e03.webp",
    products: [
      {
        id: "spot-uv",
        name: "Spot UV Cards",
        image: "https://www.exprintmart.com/_next/static/media/business-cards-dubai.0b973715.webp",
      },
    ],
  };

  const decision = decisionService.buildNestedProducts(product, selection);
  assert.strictEqual(decision.type, "SELECT_NESTED_PRODUCT");
  assert.strictEqual(
    decision.context.category.image,
    "https://www.exprintmart.com/_next/static/media/custom-business-cards-dubai.26a21e03.webp",
  );
  assert.strictEqual(
    decision.context.products[0].image,
    "https://www.exprintmart.com/_next/static/media/business-cards-dubai.0b973715.webp",
  );
});

// =========================================================
// 14. EXISTING BUTTONS CONTINUE WORKING WITH IMAGE HEADERS
// =========================================================
test("14. Existing buttons continue working with image headers (Meta Cloud API compatible)", () => {
  const adapter = new WhatsAppResponseAdapter();
  const result = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    context: {
      product: {
        id: "business-cards",
        image: "https://www.dlxprint.com/images/digital-business-cards/standard_business_cards_printing_dubai.webp",
      },
    },
    actions: [
      { id: "SELECT_SELECTION", label: "Standard", payload: { selectionId: "standard" } },
      { id: "SELECT_SELECTION", label: "Luxury", payload: { selectionId: "luxury" } },
    ],
    message: "Choose your business card type:",
  };

  const messages = adapter.toWhatsAppMessages(result);
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].type, "interactive");
  assert.strictEqual(messages[0].interactive.type, "button");
  assert.strictEqual(
    messages[0].interactive.header.image.link,
    "https://www.dlxprint.com/images/digital-business-cards/standard_business_cards_printing_dubai.webp",
  );
  assert.strictEqual(messages[0].interactive.action.buttons.length, 2);
});

// =========================================================
// 15. EXISTING ORDER_FORM CONTINUES WORKING WITHOUT PRODUCT IMAGE
// =========================================================
test("15. Existing ORDER_FORM continues working without attaching product image", () => {
  const adapter = new WhatsAppResponseAdapter();
  const formResult = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    interaction: "FORM",
    sections: [
      {
        id: "ORDER_FORM",
        type: "FORM",
        form: {
          id: "order-form-stamps",
          fields: [{ id: "quantity", type: "number", label: "Quantity" }],
        },
      },
    ],
    context: {
      product: {
        id: "self-ink-stamps",
        image: "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
      },
    },
  };

  const image = adapter.extractProductImage(formResult);
  assert.strictEqual(image, null);
});

// =========================================================
// 16. GREETING USES EXACT EXPRINTMART LOGO SVG
// =========================================================
test("16. Greeting uses exact ExprintMart logo SVG URL as brand asset", async () => {
  const greetingNode = new GreetingNode();
  const state = await greetingNode.execute({
    site: "exprintmart",
    visitorType: "VISITOR",
    persistence: { conversation: { dirty: false } },
  });

  assert.strictEqual(
    state.response.data.brandAsset,
    "https://www.exprintmart.com/_next/static/media/exprint_logo.41b1dc5b.svg",
  );

  const adapter = new WhatsAppResponseAdapter();
  const messages = adapter.toWhatsAppMessages({
    workflow: "GREETING",
    response: state.response,
  });

  assert.ok(messages.length > 0);
  const imageMsg = messages.find((m) => m.type === "image");
  assert.ok(imageMsg, "Greeting must attach brand asset image");
  assert.strictEqual(
    imageMsg.image.link,
    "https://www.exprintmart.com/_next/static/media/exprint_logo.41b1dc5b.svg",
  );
});

// =========================================================
// 17. PRODUCT RESPONSES NEVER USE GREETING LOGO
// =========================================================
test("17. Product responses NEVER use the greeting logo", async () => {
  const salesNode = new SalesNode();
  const result = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    userMessage: "I want stamps",
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  const adapter = new WhatsAppResponseAdapter();
  const image = adapter.extractProductImage(result);
  assert.notStrictEqual(image, BRAND_GREETING_LOGO_URL);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
});

// =========================================================
// 18. LLM OUTPUT CANNOT OVERRIDE CATALOG IMAGE
// =========================================================
test("18. LLM output text/assistantMessage cannot override catalog image", () => {
  const adapter = new WhatsAppResponseAdapter();
  const resultWithLlmHallucination = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    assistantMessage: "Here is your image: https://random-image.com/fake.png",
    response: {
      message: "Here is your image: https://random-image.com/fake.png",
    },
    context: {
      product: {
        id: "self-ink-stamps",
        image: "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
      },
    },
  };

  const image = adapter.extractProductImage(resultWithLlmHallucination);
  assert.strictEqual(
    image,
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
  assert.notStrictEqual(image, "https://random-image.com/fake.png");
});

// =========================================================
// 19. DUPLICATE WEBHOOK DOES NOT DUPLICATE IMAGE SEND
// =========================================================
test("19. Duplicate webhook does not duplicate message/image send", () => {
  const service = new WhatsAppService({
    conversationRepository: { findBySessionId: async () => null, createConversation: async () => ({}) },
  });

  const messageId = "wamid.dup_test_image_123";
  assert.strictEqual(service.isDuplicateMessage(messageId), false);
  service.markMessageProcessed(messageId);
  assert.strictEqual(service.isDuplicateMessage(messageId), true);
});

// =========================================================
// 20. OUTBOUND POLICY BLOCKS WHEN WINDOW EXPIRED
// =========================================================
test("20. Outbound policy strictly blocks outbound when window is expired", () => {
  const service = new WhatsAppService();
  const customerWaId = "918310412768";
  const now = Date.now();
  const expiredTimestamp = now - 25 * 60 * 60 * 1000; // 25 hours ago

  const auth = service.outboundPolicy.authorizeOutbound({
    to: customerWaId,
    message: { type: "image", image: { link: "https://www.dlxprint.com/image.webp" } },
    inboundTriggerContext: {
      triggeredByInboundMessage: true,
      inboundMessageId: "msg_expired_123",
      customerWaId,
    },
    lastUserMessageAt: expiredTimestamp,
    now,
  });

  assert.strictEqual(auth.blocked, true);
  assert.strictEqual(auth.reason, "CUSTOMER_SERVICE_WINDOW_EXPIRED");
});

// =========================================================
// TEST A: Business Cards -> Budget-Friendly -> Affordable
// =========================================================
test("TEST A: Business Cards -> Budget-Friendly -> Affordable resolves concrete productId and normalized catalog image", async () => {
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

  // 1. Concrete product identity
  assert.strictEqual(res.currentStep, "PRODUCT_DETAILS");
  const itemProduct = res.order?.items?.[0]?.product;
  assert.ok(itemProduct, "Order item product must exist");
  assert.strictEqual(itemProduct.id, "affordable");
  assert.strictEqual(itemProduct.parentProductId, "business-cards");
  assert.strictEqual(itemProduct.parentSelectionId, "budget-friendly");

  // 2. WhatsApp messages conversion
  const adapter = new WhatsAppResponseAdapter();
  const messages = adapter.toWhatsAppMessages(res);
  assert.ok(messages.length >= 1, "Must produce message with product details and ORDER NOW button");

  const msg = messages[0];
  assert.strictEqual(msg.type, "interactive");
  assert.strictEqual(msg.interactive.type, "button");
  assert.strictEqual(
    msg.interactive.header?.image?.link,
    "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp",
  );
  assert.ok(msg.interactive.body?.text, "Body caption must be present");
  assert.ok(
    !msg.interactive.header.image.link.includes("webphttps"),
    "Duplicated URL must be normalized",
  );
  assert.ok(
    msg.interactive.body.text.includes("Affordable"),
    "Caption must include product title",
  );
  assert.ok(
    msg.interactive.body.text.length <= 1024,
    "Caption must be <= 1024 chars for WhatsApp",
  );

  // Button must be ORDER NOW
  const btn = msg.interactive.action?.buttons?.[0];
  assert.ok(btn, "ORDER NOW button must exist");
  assert.strictEqual(btn.reply.title, "ORDER NOW");
  assert.ok(btn.reply.id.startsWith("order_now:affordable:"));
  assert.ok(Buffer.byteLength(btn.reply.id, "utf8") <= 256, "Action id must be <= 256 bytes");
});

// =========================================================
// TEST B: Business Cards -> Laminated
// =========================================================
test("TEST B: Business Cards -> Laminated resolves correct catalog image", () => {
  const catalogService = new SalesCatalogService();
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
});

// =========================================================
// TEST C: Business Cards -> PVC-Plastic
// =========================================================
test("TEST C: Business Cards -> PVC-Plastic resolves correct catalog image", () => {
  const catalogService = new SalesCatalogService();
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
});

// =========================================================
// TEST D: Standees / Backdrops / Seals dynamic resolution
// =========================================================
test("TEST D: Standees / Backdrops / Seals dynamic resolution from catalog files", () => {
  const catalogService = new SalesCatalogService();

  // Backdrops
  const backdrop = catalogService.resolveProduct({ productId: "softcase-straight" });
  assert.ok(backdrop, "Must resolve backdrop from catalog");
  assert.ok(
    normalizeImageUrl(backdrop.image).includes("softcase_straight_popup_banner_printing_dubai") ||
    normalizeImageUrl(backdrop.image).includes("straight_pop_up_stand_softcase_dubai") ||
    normalizeImageUrl(backdrop.image).includes("straight_velcro_pop_up_stand_dubai"),
    "Backdrop image must match real catalog webp",
  );

  // Standees
  const standee = catalogService.getProduct("roll-up-banner") || catalogService.getProduct("roll-up-stand");
  assert.ok(standee, "Must resolve standee from catalog");
  assert.ok(
    normalizeImageUrl(standee.image).includes("roll_up_banner") ||
    normalizeImageUrl(standee.image).includes("roll_up_banner_stand_dubai.webp"),
    "Standee image must match real catalog webp",
  );

  // Seals
  const stamp = catalogService.getProduct("self-ink-stamps");
  assert.ok(stamp, "Must resolve self-ink-stamps from catalog");
  assert.strictEqual(
    normalizeImageUrl(stamp.image),
    "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
  );
});

// =========================================================
// TEST E: Missing image fallback
// =========================================================
test("TEST E: Missing image fallback generates clean text/button message without crash", () => {
  const adapter = new WhatsAppResponseAdapter();
  const noImageResult = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    context: {
      form: {
        id: "order-form-test",
        title: "Custom Order Details",
        fields: [
          {
            id: "quantity",
            type: "select",
            label: "Quantity",
            options: [
              { value: "100", label: "100 pcs" },
              { value: "250", label: "250 pcs" },
            ],
            required: true,
          },
        ],
      },
    },
    order: {
      mode: "DISCOVERY",
      currentItem: 0,
      items: [
        {
          product: {
            id: "custom-no-image-item",
            name: "Custom Mystery Product",
            image: null,
            description: "A product with no catalog image available.",
          },
          formData: {},
        },
      ],
    },
  };

  const messages = adapter.toWhatsAppMessages(noImageResult);
  assert.ok(messages.length >= 2, "Must produce text caption followed by interactive prompt");
  assert.strictEqual(messages[0].type, "text", "Message 1 must fallback to text when image is missing");
  assert.ok(messages[0].text.body.includes("Custom Mystery Product"));
  assert.strictEqual(messages[1].type, "interactive", "Message 2 must be interactive controls");
});

// =========================================================
// TEST F: Duplicated URL in catalog normalized
// =========================================================
test("TEST F: Duplicated URL normalization covers repeated URLs, commas, spaces, and arrays", () => {
  const sampleUrl = "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp";

  // 1. Direct concatenation
  assert.strictEqual(normalizeImageUrl(`${sampleUrl}${sampleUrl}`), sampleUrl);

  // 2. Comma separated
  assert.strictEqual(normalizeImageUrl(`${sampleUrl}, ${sampleUrl}`), sampleUrl);

  // 3. Space separated
  assert.strictEqual(normalizeImageUrl(`${sampleUrl} ${sampleUrl}`), sampleUrl);

  // 4. Array input
  assert.strictEqual(normalizeImageUrl([sampleUrl, sampleUrl]), sampleUrl);

  // 5. Half-repeated string
  const half = "https://site.com/img.png";
  assert.strictEqual(normalizeImageUrl(half + half), half);
});

// =========================================================
// TEST G: Malicious / invalid image path rejected
// =========================================================
test("TEST G: Malicious or invalid image paths are rejected strictly", () => {
  assert.strictEqual(normalizeImageUrl("http://localhost:3000/test.png"), null);
  assert.strictEqual(normalizeImageUrl("http://127.0.0.1/test.png"), null);
  assert.strictEqual(normalizeImageUrl("http://192.168.1.100/test.png"), null);
  assert.strictEqual(normalizeImageUrl("http://10.0.0.1/test.png"), null);
  assert.strictEqual(normalizeImageUrl("javascript:alert(1)"), null);
  assert.strictEqual(normalizeImageUrl("data:image/png;base64,iVBORw0KGgo="), null);
  assert.strictEqual(normalizeImageUrl("file:///etc/passwd"), null);
  assert.strictEqual(normalizeImageUrl("../../etc/passwd"), null);
});

// =========================================================
// TEST H: Interactive buttons continue working
// =========================================================
test("TEST H: Interactive buttons continue working with action codecs", () => {
  const adapter = new WhatsAppResponseAdapter();
  const result = {
    workflow: "SALES",
    currentStep: "SELECT_NESTED_PRODUCT",
    context: {
      category: {
        id: "budget-friendly",
        name: "Budget-Friendly Cards",
        image: "https://www.exprintmart.com/_next/static/media/business-cards-printing-in-dubai.8477bbdb.webp",
      },
      products: [
        { id: "affordable", name: "Affordable Cards" },
        { id: "laminated", name: "Laminated Cards" },
      ],
    },
    actions: [
      {
        id: "SELECT_NESTED_PRODUCT",
        label: "Affordable",
        payload: { nestedProductId: "affordable", productId: "business-cards", selectionId: "budget-friendly" },
      },
      {
        id: "SELECT_NESTED_PRODUCT",
        label: "Laminated",
        payload: { nestedProductId: "laminated", productId: "business-cards", selectionId: "budget-friendly" },
      },
    ],
    message: "Choose your card style:",
  };

  const messages = adapter.toWhatsAppMessages(result);
  assert.strictEqual(messages.length, 1);
  const btnMsg = messages[0];
  assert.strictEqual(btnMsg.type, "interactive");
  assert.strictEqual(btnMsg.interactive.type, "button");
  assert.strictEqual(btnMsg.interactive.action.buttons.length, 2);

  const btnId0 = btnMsg.interactive.action.buttons[0].reply.id;
  assert.ok(
    btnId0.startsWith("nested:") || btnId0.startsWith("ButtonsV3:") || btnId0.includes("affordable"),
    "Button ID must preserve valid action codec",
  );
});

// =========================================================
// TEST I: Existing ORDER_FORM transition
// =========================================================
test("TEST I: Existing ORDER_FORM sends image on initial entry, does not repeat image on subsequent field steps", () => {
  const adapter = new WhatsAppResponseAdapter();

  const formSchema = {
    id: "order-form-stamps",
    title: "Self Ink Stamps Order",
    fields: [
      { id: "inkColor", type: "select", label: "Ink Color", options: [{ value: "blue", label: "Blue" }, { value: "black", label: "Black" }], required: true },
      { id: "quantity", type: "number", label: "Quantity", required: true },
    ],
  };

  // Step 1: Initial entry (filledFields.length === 0)
  const step1Result = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    context: {
      form: formSchema,
    },
    order: {
      mode: "DISCOVERY",
      currentItem: 0,
      items: [
        {
          product: {
            id: "self-ink-stamps",
            name: "Self Ink Stamps",
            image: "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
          },
          formData: {},
        },
      ],
    },
  };

  const step1Messages = adapter.toWhatsAppMessages(step1Result);
  assert.strictEqual(step1Messages.length, 2);
  assert.strictEqual(step1Messages[0].type, "image", "Step 1 must include catalog product image");
  assert.strictEqual(step1Messages[1].type, "interactive", "Step 1 must include interactive field controls");

  // Step 2: In-progress entry (filledFields.length === 1)
  const step2Result = {
    workflow: "SALES",
    currentStep: "ORDER_FORM",
    context: {
      form: formSchema,
    },
    order: {
      mode: "DISCOVERY",
      currentItem: 0,
      items: [
        {
          product: {
            id: "self-ink-stamps",
            name: "Self Ink Stamps",
            image: "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
          },
          formData: { inkColor: "blue" }, // Field already filled!
        },
      ],
    },
  };

  const step2Messages = adapter.toWhatsAppMessages(step2Result);
  // Step 2 should only send the prompt for the remaining field (quantity), NOT re-send the product image!
  const hasImageInStep2 = step2Messages.some((m) => m.type === "image");
  assert.strictEqual(hasImageInStep2, false, "Step 2+ must NOT re-send the product image");
});

// =========================================================
// TEST J: Web channel response contracts unaffected
// =========================================================
test("TEST J: Web channel response contracts unaffected", async () => {
  const salesNode = new SalesNode();
  const result = await salesNode.execute({
    site: "exprintmart",
    channel: "WEB",
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "self-ink-stamps" },
    },
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  assert.strictEqual(result.workflow, "SALES");
  assert.ok(result.response?.sections || result.sections, "Web response must include sections array");
  assert.ok(Array.isArray(result.response?.actions || result.actions), "Web response must include actions array");
  assert.ok(result.currentStep, "Web response must include currentStep");
  // Ensure response object exists
  assert.ok(result.response, "Web response must include response object");
  assert.strictEqual(result.response.workflow, "SALES");
});

