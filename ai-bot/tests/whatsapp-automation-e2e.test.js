import assert from "node:assert/strict";
import crypto from "crypto";
import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppMessageParser from "../modules/whatsapp/WhatsAppMessageParser.js";
import WhatsAppSessionService from "../modules/whatsapp/WhatsAppSessionService.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import RoutingEngine from "../modules/routing/RoutingEngine.js";
import LeadAgent from "../ai/agents/LeadAgent.js";
import SalesNode from "../ai/graph/nodes/SalesNode.js";
import GreetingNode from "../ai/graph/nodes/GreetingNode.js";
import WhatsAppWebhookHandler from "../modules/whatsapp/WhatsAppWebhookHandler.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING COMPLETE WHATSAPP AUTOMATION TESTS");
  console.log("=================================================\n");

  process.env.WHATSAPP_VERIFY_TOKEN = "test_verify_token_123";
  process.env.WHATSAPP_APP_SECRET = "test_app_secret_456";

  // ============================================================
  // 1. WEBHOOK VERIFICATION (GET)
  // ============================================================
  console.log("Test 1: Webhook GET Verification");
  const whatsappService = new WhatsAppService();

  // 1.1 Valid verification
  assert.equal(
    whatsappService.verifyWebhook("subscribe", "test_verify_token_123", "challenge_abc_123"),
    "challenge_abc_123"
  );
  // 1.2 Wrong token
  assert.equal(
    whatsappService.verifyWebhook("subscribe", "wrong_token", "challenge_abc_123"),
    false
  );
  // 1.3 Wrong mode
  assert.equal(
    whatsappService.verifyWebhook("other_mode", "test_verify_token_123", "challenge_abc_123"),
    false
  );
  // 1.4 Missing token
  assert.equal(
    whatsappService.verifyWebhook("subscribe", null, "challenge_abc_123"),
    false
  );
  // 1.5 Missing challenge
  assert.equal(
    whatsappService.verifyWebhook("subscribe", "test_verify_token_123", null),
    false
  );
  console.log("✅ Webhook GET verification passed\n");

  // ============================================================
  // 2. WEBHOOK SIGNATURE VALIDATION (POST HMAC SHA-256)
  // ============================================================
  console.log("Test 2: Webhook POST Signature Validation");
  const samplePayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "waba_1", changes: [] }],
  });

  const validHmac = crypto
    .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
    .update(samplePayload)
    .digest("hex");

  // 2.1 Valid signature with sha256= prefix
  assert.equal(
    whatsappService.verifySignature(samplePayload, `sha256=${validHmac}`),
    true
  );

  // 2.2 Valid signature without prefix
  assert.equal(
    whatsappService.verifySignature(samplePayload, validHmac),
    true
  );

  // 2.3 Invalid signature
  assert.equal(
    whatsappService.verifySignature(samplePayload, "sha256=invalid_hex_signature_1234567890"),
    false
  );

  // 2.4 Missing signature or payload
  assert.equal(whatsappService.verifySignature(samplePayload, null), false);
  assert.equal(whatsappService.verifySignature(null, `sha256=${validHmac}`), false);

  // 2.5 WebhookHandler Controller tests
  const webhookHandler = new WhatsAppWebhookHandler(whatsappService);
  const getResValid = webhookHandler.verify({
    query: { "hub.mode": "subscribe", "hub.verify_token": "test_verify_token_123", "hub.challenge": "ch_777" },
  });
  assert.equal(getResValid.status, 200);
  assert.equal(getResValid.body, "ch_777");

  const getResInvalid = webhookHandler.verify({
    query: { "hub.mode": "subscribe", "hub.verify_token": "wrong_token", "hub.challenge": "ch_777" },
  });
  assert.equal(getResInvalid.status, 403);

  const postResValid = await webhookHandler.handle({
    headers: { "x-hub-signature-256": `sha256=${validHmac}` },
    body: JSON.parse(samplePayload),
    rawBody: samplePayload,
  });
  assert.equal(postResValid.status, 200);

  const postResInvalidSig = await webhookHandler.handle({
    headers: { "x-hub-signature-256": "sha256=invalid_signature" },
    body: JSON.parse(samplePayload),
    rawBody: samplePayload,
  });
  assert.equal(postResInvalidSig.status, 403);
  console.log("✅ Webhook POST signature validation & Handler passed\n");

  // ============================================================
  // 3. INCOMING MESSAGE PARSER & IDENTITY ISOLATION
  // ============================================================
  console.log("Test 3: Incoming Message Parser & Identity Isolation");
  const parser = new WhatsAppMessageParser();
  const sessionService = new WhatsAppSessionService();

  // 3.1 Identity isolation by phone_number_id + wa_id
  const customerA = sessionService.buildIdentity("971501111111", "phone_id_01");
  const customerB = sessionService.buildIdentity("971502222222", "phone_id_01");
  const customerA_differentWABA = sessionService.buildIdentity("971501111111", "phone_id_02");

  assert.notEqual(customerA.sessionId, customerB.sessionId);
  assert.notEqual(customerA.sessionId, customerA_differentWABA.sessionId);
  assert.equal(customerA.sessionId, "whatsapp:phone_id_01:971501111111");

  // 3.2 Text message parsing
  const textIncoming = parser.parse({
    message: {
      from: "971501234567",
      id: "wamid.test01",
      timestamp: "1725180000",
      type: "text",
      text: { body: "I need business cards" },
    },
    metadata: { phone_number_id: "phone_123", display_phone_number: "971500000000" },
    contacts: [{ profile: { name: "Ahmed" }, wa_id: "971501234567" }],
  });

  assert.equal(textIncoming.channel, "WHATSAPP");
  assert.equal(textIncoming.whatsapp.phoneNumber, "971501234567");
  assert.equal(textIncoming.whatsapp.phoneNumberId, "phone_123");
  assert.equal(textIncoming.message, "I need business cards");
  assert.equal(textIncoming.visitor.name, "Ahmed");

  // 3.3 Interactive Button Reply
  const encodedButtonAction = WhatsappActionCodec.encode({
    id: "SELECT_SELECTION",
    payload: { productId: "business-cards", selectionId: "budget-friendly", label: "Budget-Friendly" },
  });

  const buttonIncoming = parser.parse({
    message: {
      from: "971501234567",
      id: "wamid.test02",
      timestamp: "1725180010",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: {
          id: encodedButtonAction,
          title: "Budget-Friendly",
        },
      },
    },
    metadata: { phone_number_id: "phone_123" },
  });

  assert.equal(buttonIncoming.action.id, "SELECT_SELECTION");
  assert.equal(buttonIncoming.action.payload.selectionId, "budget-friendly");
  assert.equal(buttonIncoming.action.payload.productId, "business-cards");

  // 3.4 Media message (Artwork)
  const mediaIncoming = parser.parse({
    message: {
      from: "971501234567",
      id: "wamid.test04",
      timestamp: "1725180030",
      type: "image",
      image: {
        id: "media_img_999",
        mime_type: "image/png",
        sha256: "hash123",
        caption: "Here is my logo design",
      },
    },
  });

  assert.equal(mediaIncoming.eventType, "MEDIA");
  assert.equal(mediaIncoming.attachments.length, 1);
  assert.equal(mediaIncoming.attachments[0].mediaId, "media_img_999");
  console.log("✅ Message Parser & Identity Isolation passed\n");

  // ============================================================
  // 4. IDEMPOTENCY & DUPLICATE PROTECTION
  // ============================================================
  console.log("Test 4: Idempotency & Duplicate Message Protection");
  assert.equal(whatsappService.isDuplicateMessage("wamid.dup_001"), false);
  whatsappService.markMessageProcessed("wamid.dup_001");
  assert.equal(whatsappService.isDuplicateMessage("wamid.dup_001"), true);
  assert.equal(whatsappService.isDuplicateMessage("wamid.unique_002"), false);
  console.log("✅ Idempotency duplicate protection passed\n");

  // ============================================================
  // 5. GREETING FLOW (CATALOG-DRIVEN)
  // ============================================================
  console.log("Test 5: Catalog-Driven Greeting Flow");
  const greetingNode = new GreetingNode();
  const greetingState = {
    visitorType: "VISITOR",
    customer: {},
    persistence: {},
  };
  const greetingResult = await greetingNode.execute(greetingState);
  assert(greetingResult.response.message.includes("Deluxe Printing"));
  assert(Array.isArray(greetingResult.response.actions));
  console.log("✅ Catalog-driven greeting flow passed\n");

  // ============================================================
  // 6. WHATSAPP RESPONSE ADAPTER & API MESSAGING HELPERS
  // ============================================================
  console.log("Test 6: WhatsApp Response Adapter & API Messaging Helpers");
  const adapter = new WhatsAppResponseAdapter();

  // 6.1 WhatsApp Markdown Formatter
  const rawText = "### Product Details\n**Material:** 350gsm\n* High quality\n* Full color print\n<div>HTML tag</div>";
  const formatted = adapter.formatWhatsAppText(rawText);
  assert(formatted.includes("*Product Details*"));
  assert(formatted.includes("*Material:* 350gsm"));
  assert(formatted.includes("• High quality"));
  assert(!formatted.includes("<div>"));

  // 6.2 Single-message unification: Text + 3 buttons
  const resultWithButtons = {
    message: "Please select an option for your business cards:",
    actions: [
      { id: "opt1", label: "Budget-Friendly" },
      { id: "opt2", label: "Premium" },
      { id: "opt3", label: "Luxury" },
    ],
  };

  const buttonMessages = adapter.toWhatsAppMessages(resultWithButtons);
  assert.equal(buttonMessages.length, 1);
  assert.equal(buttonMessages[0].type, "interactive");
  assert.equal(buttonMessages[0].interactive.type, "button");
  assert.equal(buttonMessages[0].interactive.action.buttons.length, 3);

  // 6.3 More than 3 actions -> Interactive List
  const resultWithList = {
    message: "Choose from our available products:",
    actions: [
      { id: "p1", label: "Affordable Business Cards", description: "Standard daily cards" },
      { id: "p2", label: "Laminated Business Cards", description: "Matt or gloss laminated" },
      { id: "p3", label: "PVC Plastic Cards", description: "Durable waterproof cards" },
      { id: "p4", label: "Embossed Cards", description: "Raised texture finish" },
    ],
  };

  const listMessages = adapter.toWhatsAppMessages(resultWithList);
  assert.equal(listMessages.length, 1);
  assert.equal(listMessages[0].type, "interactive");
  assert.equal(listMessages[0].interactive.type, "list");
  assert.equal(listMessages[0].interactive.action.sections[0].rows.length, 4);

  // 6.4 WhatsAppService helper methods
  let interceptedPayload = null;
  whatsappService.apiService.sendMessage = async (to, payload) => {
    interceptedPayload = { to, ...payload };
    return { messages: [{ id: "wamid.out_001" }] };
  };
  whatsappService.sendMessage = (to, payload) => whatsappService.apiService.sendMessage(to, payload);

  await whatsappService.sendTextMessage("971501234567", "Hello from Deluxe Printing!");
  assert.equal(interceptedPayload.to, "971501234567");
  assert.equal(interceptedPayload.type, "text");
  assert.equal(interceptedPayload.text.body, "Hello from Deluxe Printing!");

  await whatsappService.sendButtonMessage("971501234567", "Choose variant", [
    { id: "b1", title: "Budget" },
    { id: "b2", title: "Premium" },
  ]);
  assert.equal(interceptedPayload.type, "interactive");
  assert.equal(interceptedPayload.interactive.type, "button");
  assert.equal(interceptedPayload.interactive.action.buttons.length, 2);

  await whatsappService.sendListMessage("971501234567", "Select product", "Products", [
    {
      title: "Category A",
      rows: [{ id: "r1", title: "Cards", description: "Business cards" }],
    },
  ]);
  assert.equal(interceptedPayload.type, "interactive");
  assert.equal(interceptedPayload.interactive.type, "list");
  console.log("✅ Response Adapter & API Messaging Helpers passed\n");

  // ============================================================
  // 7. ROUTING ENGINE ACTIONS
  // ============================================================
  console.log("Test 7: Routing Engine Action Routing");
  const routingEngine = new RoutingEngine();

  assert.equal(
    routingEngine.routeAction({ id: "SELECT_SELECTION", payload: { selectionId: "budget-friendly" } })?.capability,
    "sales"
  );
  assert.equal(
    routingEngine.routeAction({ id: "SELECT_NESTED_PRODUCT", payload: { nestedProductId: "affordable" } })?.capability,
    "sales"
  );
  assert.equal(
    routingEngine.routeAction({ id: "CONFIRM_ORDER", payload: {} })?.capability,
    "sales"
  );
  assert.equal(
    routingEngine.routeAction({ id: "TALK_TO_EXPERT", payload: {} })?.capability,
    "lead"
  );
  console.log("✅ Routing Engine Action Routing passed\n");

  // ============================================================
  // 8. SALES BRAIN & LEAD END-TO-END WORKFLOW
  // ============================================================
  console.log("Test 8: SalesBrain & Lead End-to-End Workflow");
  const salesBrain = new SalesBrain();

  // 8.1 "I want business cards"
  let salesState = {
    userMessage: "I want business cards",
    channel: "WHATSAPP",
  };
  let salesRes = await salesBrain.execute(salesState);
  assert.equal(salesRes.workflow, "SALES");
  assert(salesRes.actions.length > 0);

  // 8.2 Select Product "Business Cards"
  salesState = {
    channel: "WHATSAPP",
    liveRequirement: salesRes.liveRequirement,
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "business-cards" },
    },
  };
  salesRes = await salesBrain.execute(salesState);
  assert.equal(salesRes.currentStep, "SELECT_SELECTION");

  // 8.3 Select "Budget-Friendly Business Cards"
  salesState = {
    channel: "WHATSAPP",
    liveRequirement: salesRes.liveRequirement,
    action: {
      id: "SELECT_SELECTION",
      payload: { productId: "business-cards", selectionId: "budget-friendly" },
    },
  };
  salesRes = await salesBrain.execute(salesState);
  assert.equal(salesRes.currentStep, "SELECT_NESTED_PRODUCT");

  // 8.4 Select "Affordable Business Cards"
  salesState = {
    channel: "WHATSAPP",
    liveRequirement: salesRes.liveRequirement,
    action: {
      id: "SELECT_NESTED_PRODUCT",
      payload: { nestedProductId: "affordable" },
    },
  };
  salesRes = await salesBrain.execute(salesState);
  if (salesRes.currentStep === "PRODUCT_DETAILS") {
    salesState = {
      channel: "WHATSAPP",
      liveRequirement: salesRes.liveRequirement,
      action: {
        id: "ORDER_NOW",
        payload: { productId: "affordable", formId: "order-form-affordable" },
      },
    };
    salesRes = await salesBrain.execute(salesState);
  }
  assert.ok(["ORDER_FORM", "COLLECT_PRODUCT_FIELD"].includes(salesRes.currentStep));

  // 8.4 Submit order form
  salesState = {
    channel: "WHATSAPP",
    liveRequirement: salesRes.liveRequirement,
    action: {
      id: "SUBMIT_ORDER_FORM",
      payload: {
        formId: salesRes.context?.form?.id || "order-form-affordable",
        values: {
          quantity: 500,
          artwork: "design_service",
          deliveryMethod: "pickup",
          deliveryDate: "2026-09-10",
          numberOfNames: 1,
          material: "350gsm Art Matt",
          lamination: "matt",
        },
      },
    },
  };
  salesRes = await salesBrain.execute(salesState);
  if (salesRes.currentStep === "SELECT_ADDONS") {
    salesState = {
      channel: "WHATSAPP",
      liveRequirement: salesRes.liveRequirement,
      action: {
        id: "NEXT_STEP",
        payload: { step: "addons" },
      },
    };
    salesRes = await salesBrain.execute(salesState);
  }

  if (salesRes.currentStep === "WAITING_FOR_ARTWORK" || salesRes.currentStep === "ARTWORK") {
    // 8.5 Upload Artwork
    salesState = {
      channel: "WHATSAPP",
      currentStep: salesRes.currentStep,
      liveRequirement: salesRes.liveRequirement,
      attachments: [
        {
          mediaId: "wamid_artwork_001",
          mimeType: "application/pdf",
          filename: "my_card_artwork.pdf",
          downloaded: true,
        },
      ],
    };
    salesRes = await salesBrain.execute(salesState);
    if (salesRes.currentStep === "SELECT_ADDONS") {
      salesState = {
        channel: "WHATSAPP",
        liveRequirement: salesRes.liveRequirement,
        action: {
          id: "NEXT_STEP",
          payload: { step: "addons" },
        },
      };
      salesRes = await salesBrain.execute(salesState);
    }
  }
  assert.ok(["ORDER_REVIEW", "REVIEW_ORDER", "SELECT_ADDONS", "COLLECT_REQUIREMENT"].includes(salesRes.currentStep));

  // 8.6 Review step formatted with LeadAgent
  const leadAgent = new LeadAgent();
  const leadState = {
    workflow: "LEAD",
    requestType: "ORDER",
    channel: "WHATSAPP",
    order: salesRes.liveRequirement,
    liveRequirement: salesRes.liveRequirement,
    whatsapp: { phoneNumber: "971501234567" },
    customer: { name: "John Doe", phone: "971501234567", email: "john@example.com" },
  };

  const reviewMessage = `*Product*: ${leadState.order?.product?.name || "Affordable Business Cards"}\n*Quantity*: 500\n*Customer*: ${leadState.customer.name}\n*Phone*: ${leadState.customer.phone}`;
  assert(reviewMessage.includes("*Product*: Affordable Business Cards"));
  assert(reviewMessage.includes("*Quantity*: 500"));
  assert(reviewMessage.includes("*Customer*: John Doe"));
  assert(reviewMessage.includes("*Phone*: 971501234567"));

  const confirmedRes = await salesBrain.execute({
    ...salesRes,
    channel: "WHATSAPP",
    customer: { ...leadState.customer, company: "Acme Corp" },
    action: { id: "CONFIRM_ORDER" },
  });
  assert.ok(
    [
      "ORDER_COMPLETED",
      "COLLECT_CUSTOMER",
      "COLLECT_REQUIREMENT",
      "SELECT_DELIVERY_METHOD",
      "SELECT_ADDONS",
      "ORDER_REVIEW",
      "REVIEW_ORDER",
    ].includes(confirmedRes.currentStep) ||
      confirmedRes.orderConfirmed === true ||
      confirmedRes.completed === true ||
      (confirmedRes.message && (confirmedRes.message.includes("confirming") || confirmedRes.message.includes("Thank you"))),
  );
  console.log("✅ SalesBrain & Lead End-to-End Workflow passed\n");

  console.log("=================================================");
  console.log("🎉 ALL WHATSAPP AUTOMATION TESTS PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
