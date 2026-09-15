import { test } from "node:test";
import assert from "node:assert";

import TelegramService from "../modules/telegram/TelegramService.js";
import SalespersonRouter from "../modules/sales/services/SalespersonRouter.js";
import SalesSummaryService from "../modules/sales/services/SalesSummaryService.js";
import SalesHandoffService from "../modules/sales/services/SalesHandoffService.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";

// Mock Telegram Transport for testing
class MockTelegramService extends TelegramService {
  constructor(config = {}) {
    super({ enabled: true, token: "mock-token", chatId: "mock-default-chat", ...config });
    this.sentMessages = [];
    this.failNext = false;
  }

  async send(message, targetChatId = null) {
    if (this.failNext) {
      this.failNext = false;
      return false;
    }
    this.sentMessages.push({
      chatId: targetChatId || this.chatId,
      text: message,
      timestamp: Date.now(),
    });
    return true;
  }
}

// =========================================================
// TEST 1: Customer asks about product (No handoff triggered)
// =========================================================
test("Test 1: No Telegram summary sent during discovery / product browsing", async () => {
  const mockTelegram = new MockTelegramService();
  const handoffService = new SalesHandoffService({ telegramService: mockTelegram });

  const discoveryState = {
    workflow: "SALES",
    currentStep: "SELECT_PRODUCT",
    userMessage: "I need roll up banner",
    customer: { phone: "+971501234567" },
  };

  // State is in discovery, handoff is not invoked or should not deliver if not ready
  assert.strictEqual(mockTelegram.sentMessages.length, 0);
});

// =========================================================
// TEST 2: Sales handoff becomes ready -> exactly one summary
// =========================================================
test("Test 2: Exactly one Telegram summary sent when sales handoff is ready", async () => {
  const mockTelegram = new MockTelegramService();
  const handoffService = new SalesHandoffService({ telegramService: mockTelegram });

  const state = {
    sessionId: "sess_test_2",
    workflow: "LEAD",
    currentStep: "LEAD_COMPLETED",
    customer: {
      name: "Mohammadkaif",
      phone: "+971509999999",
      email: "kaif@example.com",
      company: "Exprintmart",
    },
    order: {
      items: [
        {
          product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" },
          selection: { id: "85x200", name: "85 × 200 cm" },
          formData: { quantity: 25, artwork: "Design required" },
          pricing: { total: 3275, currency: "AED" },
        },
      ],
      delivery: { method: "delivery", address: "Burj Al Arab" },
    },
  };

  const result = await handoffService.triggerHandoff(state, "SALES_HANDOFF");
  assert.strictEqual(result.sent, true);
  assert.strictEqual(mockTelegram.sentMessages.length, 1);

  const sent = mockTelegram.sentMessages[0];
  assert.ok(sent.text.includes("SALES SUMMARY"));
  assert.ok(sent.text.includes("Mohammadkaif"));
  assert.ok(sent.text.includes("Roll-Up Banner"));
  assert.ok(sent.text.includes("85 × 200 cm"));
  assert.ok(sent.text.includes("Backdrops &amp; Exhibition") || sent.text.includes("Backdrops & Exhibition"));
});

// =========================================================
// TEST 3: Correct Category Routing
// =========================================================
test("Test 3: Category routing sends to designated salesperson chat IDs", async () => {
  const customMapping = {
    "backdrops & exhibition": {
      salespersonId: "sales_exhibition",
      telegramChatId: "-1001111111",
    },
    "print & marketing": {
      salespersonId: "sales_stationery",
      telegramChatId: "-1002222222",
    },
    "business cards": {
      salespersonId: "sales_stationery",
      telegramChatId: "-1002222222",
    },
    signage: {
      salespersonId: "sales_signage",
      telegramChatId: "-1003333333",
    },
  };

  const router = new SalespersonRouter(customMapping, "-1009999999");
  const mockTelegram = new MockTelegramService();
  const handoffService = new SalesHandoffService({
    telegramService: mockTelegram,
    salespersonRouter: router,
  });

  // 3a. Exhibition product
  const exhibitionState = {
    sessionId: "sess_exh_1",
    customer: { name: "Ziyad", phone: "+971501111111" },
    order: {
      items: [
        {
          product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" },
          formData: { quantity: 10 },
        },
      ],
    },
  };

  await handoffService.triggerHandoff(exhibitionState, "SALES_HANDOFF");
  assert.strictEqual(mockTelegram.sentMessages[0].chatId, "-1001111111");

  // 3b. Business Cards
  const cardsState = {
    sessionId: "sess_card_1",
    customer: { name: "Umair", phone: "+971502222222" },
    order: {
      items: [
        {
          product: { id: "business-cards", name: "Business Cards", mainCategory: "Business Cards" },
          formData: { quantity: 500 },
        },
      ],
    },
  };

  await handoffService.triggerHandoff(cardsState, "SALES_HANDOFF");
  assert.strictEqual(mockTelegram.sentMessages[1].chatId, "-1002222222");

  // 3c. Signage
  const signageState = {
    sessionId: "sess_sign_1",
    customer: { name: "Atif", phone: "+971503333333" },
    order: {
      items: [
        {
          product: { id: "3d-acrylic-sign", name: "3D Acrylic Sign", mainCategory: "Signage" },
          formData: { quantity: 1 },
        },
      ],
    },
  };

  await handoffService.triggerHandoff(signageState, "SALES_HANDOFF");
  assert.strictEqual(mockTelegram.sentMessages[2].chatId, "-1003333333");
});

// =========================================================
// TEST 4: Unknown Category Safe Fallback
// =========================================================
test("Test 4: Unknown category does not send to random salesperson and fails safely", async () => {
  // Router with NO default fallback
  const strictRouter = new SalespersonRouter({ "business cards": { salespersonId: "sales_1", telegramChatId: "123" } }, null);
  const mockTelegram = new MockTelegramService();
  const handoffService = new SalesHandoffService({
    telegramService: mockTelegram,
    salespersonRouter: strictRouter,
  });

  const unknownState = {
    sessionId: "sess_unknown_1",
    order: {
      items: [{ product: { id: "unrecognized-item", name: "Space Shuttle", mainCategory: "Aerospace" } }],
    },
  };

  const result = await handoffService.triggerHandoff(unknownState, "SALES_HANDOFF");
  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.reason, "NO_ROUTING");
  assert.strictEqual(mockTelegram.sentMessages.length, 0, "Must not dispatch to random salesperson");
});

// =========================================================
// TEST 5 & 6: Duplicate Events & Repeated Handoff Idempotency
// =========================================================
test("Test 5 & 6: Duplicate webhook event and repeated handoff trigger are idempotent", async () => {
  const mockTelegram = new MockTelegramService();
  const handoffService = new SalesHandoffService({ telegramService: mockTelegram });

  const state = {
    sessionId: "sess_idempotent_1",
    customer: { name: "Mohsin", phone: "+971504444444" },
    order: {
      orderNumber: "ORD-9999",
      items: [{ product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" } }],
    },
  };

  // First execution
  const res1 = await handoffService.triggerHandoff(state, "SALES_HANDOFF");
  assert.strictEqual(res1.sent, true);
  assert.strictEqual(mockTelegram.sentMessages.length, 1);

  // Duplicate inbound event / retry
  const res2 = await handoffService.triggerHandoff(state, "SALES_HANDOFF");
  assert.strictEqual(res2.sent, false);
  assert.strictEqual(res2.duplicate, true);
  assert.strictEqual(mockTelegram.sentMessages.length, 1, "Must not send duplicate summary");
});

// =========================================================
// TEST 7: Customer Changes Requirement (Compact Update)
// =========================================================
test("Test 7: Customer changes quantity sends a concise SALES UPDATE without full chat", async () => {
  const mockTelegram = new MockTelegramService();
  const handoffService = new SalesHandoffService({ telegramService: mockTelegram });

  const state = {
    sessionId: "sess_update_1",
    customer: { name: "Sharifa", phone: "+971505555555" },
    order: {
      items: [
        {
          product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" },
          selection: { id: "85x200", name: "85 × 200 cm" },
        },
      ],
    },
  };

  const updateResult = await handoffService.triggerUpdate(
    state,
    {
      Quantity: "25 → 50",
      Delivery: "Burj Al Arab",
    },
    { nextAction: "Reconfirm pricing with customer." },
  );

  assert.strictEqual(updateResult.sent, true);
  assert.strictEqual(mockTelegram.sentMessages.length, 1);

  const sent = mockTelegram.sentMessages[0];
  assert.ok(sent.text.includes("SALES UPDATE"));
  assert.ok(sent.text.includes("Quantity: 25 → 50"));
  assert.ok(sent.text.includes("Reconfirm pricing with customer."));
  assert.ok(!sent.text.includes("chat_history"), "Must not include raw chat history");
});

// =========================================================
// TEST 8: Structured State is Authoritative (AI cannot override)
// =========================================================
test("Test 8: Structured catalog state is authoritative over AI hallucination", () => {
  const summaryService = new SalesSummaryService();

  const stateWithLlmNoise = {
    customer: { name: "Azmat", phone: "+971506666666" },
    order: {
      items: [
        {
          product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" },
          selection: { id: "85x200", name: "85 × 200 cm" },
          formData: { quantity: 25 },
          pricing: { total: 3275, currency: "AED" },
        },
      ],
    },
    llmOutput: {
      inventedCategory: "Luxury Jewelry",
      inventedPrice: 99999,
      inventedProduct: "Gold Banner",
    },
  };

  const summary = summaryService.buildSummary(stateWithLlmNoise);
  assert.strictEqual(summary.product.name, "Roll-Up Banner");
  assert.strictEqual(summary.product.mainCategory, "Backdrops & Exhibition");
  assert.strictEqual(summary.pricing.total, 3275);
  assert.strictEqual(summary.requirements.quantity, 25);
});

// =========================================================
// TEST 9: Telegram API Failure Handling
// =========================================================
test("Test 9: Telegram API failure does not mark false success and allows retry", async () => {
  const mockTelegram = new MockTelegramService();
  mockTelegram.failNext = true; // Fail next send

  const handoffService = new SalesHandoffService({ telegramService: mockTelegram });
  const state = {
    sessionId: "sess_fail_retry_1",
    customer: { name: "Nishan", phone: "+971507777777" },
    order: {
      items: [{ product: { id: "business-cards", name: "Business Cards", mainCategory: "Print & Marketing" } }],
    },
  };

  // First attempt fails
  const res1 = await handoffService.triggerHandoff(state, "SALES_HANDOFF");
  assert.strictEqual(res1.sent, false);
  assert.strictEqual(res1.reason, "DISPATCH_FAILED");

  // Retry attempt succeeds
  const res2 = await handoffService.triggerHandoff(state, "SALES_HANDOFF");
  assert.strictEqual(res2.sent, true);
  assert.strictEqual(mockTelegram.sentMessages.length, 1);
});

// =========================================================
// TEST 10: Special HTML Characters Escaping
// =========================================================
test("Test 10: Special HTML characters are safely escaped in Telegram message", () => {
  const telegramService = new TelegramService({ enabled: true, token: "mock", chatId: "123" });

  const rawSummary = {
    customer: {
      name: "Kaif <script>alert(1)</script>",
      phone: "+971508888888",
      company: "A & B Trading <LLC>",
    },
    product: {
      name: "Banners <Standard>",
      mainCategory: "Signage & Backdrops",
    },
    requirements: {
      artwork: "Size > 50MB & Format = PDF",
    },
    summary: "Need fast delivery < 24 hrs & high quality",
    nextAction: "Check specs < urgent > & reply",
  };

  const formatted = telegramService.formatSalesSummary(rawSummary);

  assert.ok(!formatted.includes("<script>"), "Must escape <script>");
  assert.ok(formatted.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(formatted.includes("A &amp; B Trading &lt;LLC&gt;"));
  assert.ok(formatted.includes("Size &gt; 50MB &amp; Format = PDF"));
});

// =========================================================
// TEST 11, 12, 13, 14: Missing Information Handling
// =========================================================
test("Test 11-14: Missing customer fields, company, and delivery address are cleanly identified", () => {
  const summaryService = new SalesSummaryService();

  // Missing name, email, company, and delivery address (with delivery requested)
  const partialState = {
    customer: {
      phone: "+971509990001",
    },
    order: {
      items: [
        {
          product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" },
          formData: { quantity: 10 },
        },
      ],
      delivery: { method: "delivery", address: null }, // Delivery requested but no address!
    },
  };

  const summary = summaryService.buildSummary(partialState);
  assert.strictEqual(summary.customer.name, null);
  assert.ok(summary.missingInformation.includes("Customer name"));
  assert.ok(summary.missingInformation.includes("Email address"));
  assert.ok(summary.missingInformation.includes("Company name"));
  assert.ok(summary.missingInformation.includes("Delivery address"));

  const telegramService = new TelegramService();
  const formatted = telegramService.formatSalesSummary(summary);
  assert.ok(formatted.includes("⚠️ <b>Missing</b>"));
  assert.ok(formatted.includes("• Delivery address"));
  assert.ok(formatted.includes("Name: Not provided"));
});

// =========================================================
// TEST 15 & 16: Product with and without variant
// =========================================================
test("Test 15 & 16: Product with and without variant properly resolves names", () => {
  const summaryService = new SalesSummaryService();

  // With variant
  const withVariantState = {
    customer: { name: "Rizwan", phone: "+971509990002" },
    order: {
      items: [
        {
          product: { id: "roll-up-banner", name: "Roll-Up Banner", mainCategory: "Backdrops & Exhibition" },
          selection: { id: "85x200", name: "85 × 200 cm" },
          formData: { quantity: 5 },
        },
      ],
    },
  };
  const sum1 = summaryService.buildSummary(withVariantState);
  assert.strictEqual(sum1.product.name, "Roll-Up Banner");
  assert.strictEqual(sum1.product.selectionName, "85 × 200 cm");

  // Without variant
  const withoutVariantState = {
    customer: { name: "Muazzam", phone: "+971509990003" },
    order: {
      items: [
        {
          product: { id: "custom-flag", name: "Custom Feather Flag", mainCategory: "Signage" },
          formData: { quantity: 2 },
        },
      ],
    },
  };
  const sum2 = summaryService.buildSummary(withoutVariantState);
  assert.strictEqual(sum2.product.name, "Custom Feather Flag");
  assert.strictEqual(sum2.product.selectionName, null);
});

// =========================================================
// TEST 17: Real Catalog Integration Test
// =========================================================
test("Test 17: Real catalog resolver verifies roll-up-banner + 85x200 -> Backdrops & Exhibition", () => {
  const catalogService = new SalesCatalogService();
  const summaryService = new SalesSummaryService(catalogService);

  const state = {
    customer: { name: "Mohammadkaif", phone: "+971509990004", company: "Exprintmart" },
    order: {
      items: [
        {
          productId: "roll-up-banner",
          selectionId: "85x200",
          formData: { quantity: 25 },
        },
      ],
    },
  };

  const summary = summaryService.buildSummary(state);
  assert.strictEqual(summary.product.id, "roll-up-banner");
  assert.strictEqual(summary.product.name, "Roll-Up Banner");
  assert.strictEqual(summary.product.selectionId, "85x200");
  assert.strictEqual(summary.product.selectionName, "85 × 200 cm");
  assert.strictEqual(summary.product.mainCategory, "Backdrops & Exhibition");
});

// =========================================================
// TEST 18: Privacy, Conciseness and Zero Media Rule
// =========================================================
test("Test 18: Telegram summary is text-only, concise (<= 150 words), and contains zero media/raw chat", () => {
  const telegramService = new TelegramService();
  const summaryService = new SalesSummaryService();

  const completeState = {
    sessionId: "sess_priv_1",
    customer: {
      name: "Mohammadkaif",
      phone: "+971509997768",
      company: "Exprintmart",
    },
    order: {
      items: [
        {
          product: {
            id: "roll-up-banner",
            name: "Roll-Up Banner",
            mainCategory: "Backdrops & Exhibition",
            image: "https://dlxprint.com/banner.webp", // Image present on object
          },
          selection: { id: "85x200", name: "85 × 200 cm" },
          formData: { quantity: 25, artwork: "Design required" },
          pricing: { total: 3275, currency: "AED" },
        },
      ],
      delivery: { method: "delivery", address: "Burj Al Arab" },
    },
  };

  const summary = summaryService.buildSummary(completeState);
  const formatted = telegramService.formatSalesSummary(summary);

  // Assert NO images in formatted output
  assert.ok(!formatted.includes(".webp"), "Must not include image URLs");
  assert.ok(!formatted.includes("<img"), "Must not include img tags");
  assert.ok(!formatted.includes("sess_priv_1"), "Must not leak internal session IDs");

  // Assert word count <= 150 words
  const wordCount = formatted.split(/\s+/).filter(Boolean).length;
  assert.ok(wordCount <= 150, `Summary word count (${wordCount}) must be <= 150 words`);
});
