import test from "node:test";
import assert from "node:assert/strict";

import SalesNode from "../ai/graph/nodes/SalesNode.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import GeminiProvider from "../ai/llm/providers/GeminiProvider.js";

// =========================================================
// 1. FAST PATH: SELECT_PRODUCT BYPASSES GEMINI COMPLETELY
// =========================================================
test("1. Fast Path: SELECT_PRODUCT (roll-up-banner) executes deterministically without LLM", async () => {
  const salesBrain = new SalesBrain();
  let llmCalled = false;
  salesBrain.conversationService = {
    generate: async () => {
      llmCalled = true;
      throw new Error("LLM should NOT be called for deterministic SELECT_PRODUCT!");
    },
    generateDeterministic: (context, decision) => ({
      message: "Please choose your preferred roll-up banner option:",
      interaction: "BUTTONS",
      actions: decision.actions,
      sections: decision.sections,
    }),
  };

  const result = await salesBrain.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "roll-up-banner" },
    },
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });

  assert.strictEqual(llmCalled, false, "Gemini MUST NOT be called for SELECT_PRODUCT");
  assert.strictEqual(result.workflow, "SALES");
  assert.ok(result.message);
});

// =========================================================
// 2. FAST PATH: SELECT_SELECTION BYPASSES GEMINI COMPLETELY
// =========================================================
test("2. Fast Path: SELECT_SELECTION (self-ink-stamps -> round) executes deterministically without LLM", async () => {
  const salesBrain = new SalesBrain();
  let llmCalled = false;
  salesBrain.conversationService = {
    generate: async () => {
      llmCalled = true;
      throw new Error("LLM should NOT be called for deterministic SELECT_SELECTION!");
    },
    generateDeterministic: (context, decision) => ({
      message: "Please provide the required specifications for Round Shape Stamp:",
      interaction: "BUTTONS",
      actions: decision.actions,
      sections: decision.sections,
    }),
  };

  // Step 1: Inbound stamps
  const state1 = await salesBrain.execute({
    userMessage: "I want stamps",
    channel: "WHATSAPP",
  });

  // Step 2: Select round stamp
  const state2 = await salesBrain.execute({
    ...state1,
    action: {
      id: "SELECT_SELECTION",
      payload: {
        productId: "self-ink-stamps",
        selectionId: "round",
      },
    },
  });

  assert.strictEqual(llmCalled, false, "Gemini MUST NOT be called for SELECT_SELECTION");
  assert.strictEqual(state2.workflow, "SALES");
});

// =========================================================
// 3. FAST PATH: SELECT_NESTED_PRODUCT BYPASSES GEMINI COMPLETELY
// =========================================================
test("3. Fast Path: SELECT_NESTED_PRODUCT (Pop Up Softcase - Straight) executes without LLM", async () => {
  const salesBrain = new SalesBrain();
  let llmCalled = false;
  salesBrain.conversationService = {
    generate: async () => {
      llmCalled = true;
      throw new Error("LLM should NOT be called for deterministic SELECT_NESTED_PRODUCT!");
    },
    generateDeterministic: (context, decision) => ({
      message: "Please choose a product:",
      interaction: "BUTTONS",
      actions: decision.actions,
      sections: decision.sections,
    }),
  };

  const result = await salesBrain.execute({
    channel: "WHATSAPP",
    action: {
      id: "SELECT_NESTED_PRODUCT",
      payload: {
        productId: "pop-up-display-stands",
        selectionId: "softcase-straight",
        nestedProductId: "softcase-straight",
      },
    },
  });

  assert.strictEqual(llmCalled, false, "Gemini MUST NOT be called for SELECT_NESTED_PRODUCT");
});

// =========================================================
// 4. GEMINI TIMEOUT CONTROLLER ENFORCEMENT
// =========================================================
test("4. Gemini Provider: Timeout controller prevents indefinite hanging", async () => {
  const provider = new GeminiProvider();

  // Mock getModel to simulate a hanging API call
  provider.getModel = () => ({
    invoke: () => new Promise((resolve) => setTimeout(() => resolve({ content: "too late" }), 5000)),
  });

  const startTime = Date.now();
  await assert.rejects(
    async () => {
      await provider.invoke({
        systemPrompt: "System",
        userMessage: "Hello",
        timeoutMs: 150, // Short timeout for testing
      });
    },
    (err) => {
      assert.strictEqual(err.code, "ETIMEDOUT");
      assert.ok(err.message.includes("timed out"));
      return true;
    },
  );

  const duration = Date.now() - startTime;
  assert.ok(duration < 1000, `Timeout must trigger promptly, took ${duration}ms`);
});

// =========================================================
// 5. STRUCTURED TIMEOUT CONTROLLER ENFORCEMENT
// =========================================================
test("5. Gemini Provider: Structured output timeout controller prevents indefinite hanging", async () => {
  const provider = new GeminiProvider();

  provider.getModel = () => ({
    invoke: () => new Promise((resolve) => setTimeout(() => resolve({ content: '{"message":"late"}' }), 5000)),
  });

  const startTime = Date.now();
  await assert.rejects(
    async () => {
      await provider.invokeStructured({
        schema: { type: "object" },
        systemPrompt: "System",
        userMessage: "Hello",
        timeoutMs: 150,
      });
    },
    (err) => {
      assert.strictEqual(err.code, "ETIMEDOUT");
      return true;
    },
  );

  const duration = Date.now() - startTime;
  assert.ok(duration < 1000, `Structured timeout must trigger promptly, took ${duration}ms`);
});
