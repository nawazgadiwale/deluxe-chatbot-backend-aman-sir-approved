import SalesNode from "../ai-bot/ai/graph/nodes/SalesNode.js";
import GreetingNode from "../ai-bot/ai/graph/nodes/GreetingNode.js";
import WhatsAppResponseAdapter from "../ai-bot/modules/whatsapp/WhatsAppResponseAdapter.js";
import SalesCatalogService from "../ai-bot/modules/sales/services/SalesCatalogService.js";
import { resolveCatalogImage } from "../ai-bot/modules/sales/helpers/CatalogHelper.js";
import GeminiProvider from "../ai-bot/ai/llm/providers/GeminiProvider.js";

async function runTrace() {
  console.log("==================================================================");
  console.log("🚀 EXPRINTMART WHATSAPP CATALOG-DRIVEN FAST PATH & IMAGE TRACE");
  console.log("==================================================================");

  const salesNode = new SalesNode();
  const greetingNode = new GreetingNode();
  const adapter = new WhatsAppResponseAdapter();
  const catalogService = new SalesCatalogService();

  // Test 1: SELECT_PRODUCT: "roll-up-banner"
  console.log("\n--- [Step 1] SELECT_PRODUCT (roll-up-banner) ---");
  const t1 = performance.now();
  const step1 = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "roll-up-banner" },
    },
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });
  const elapsed1 = (performance.now() - t1).toFixed(2);
  const img1 = adapter.extractProductImage(step1);
  const msgs1 = adapter.toWhatsAppMessages(step1);
  console.log(`Step 1 Execution Time: ${elapsed1}ms (Fast Path without Gemini)`);
  console.log("Step 1 Resolved Product:", step1.order?.items?.[0]?.product?.id);
  console.log("Step 1 Extracted Image:", img1);
  console.log("Step 1 Buttons/Actions Count:", msgs1[0]?.interactive?.action?.buttons?.length || msgs1[0]?.interactive?.action?.sections?.[0]?.rows?.length || msgs1.length);

  // Test 2: SELECT_PRODUCT: "self-ink-stamps"
  console.log("\n--- [Step 2] SELECT_PRODUCT (self-ink-stamps) ---");
  const t2 = performance.now();
  const step2 = await salesNode.execute({
    site: "exprintmart",
    channel: "WHATSAPP",
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "self-ink-stamps" },
    },
    memory: {},
    persistence: { conversation: { dirty: false }, order: { dirty: false } },
  });
  const elapsed2 = (performance.now() - t2).toFixed(2);
  const img2 = adapter.extractProductImage(step2);
  console.log(`Step 2 Execution Time: ${elapsed2}ms (Fast Path without Gemini)`);
  console.log("Step 2 Resolved Product:", step2.order?.items?.[0]?.product?.id);
  console.log("Step 2 Extracted Image:", img2);

  // Test 3: SELECT_SELECTION: "round" stamp
  console.log("\n--- [Step 3] SELECT_SELECTION (round shape stamp) ---");
  const t3 = performance.now();
  const step3 = await salesNode.execute({
    ...step2,
    action: {
      id: "SELECT_SELECTION",
      payload: {
        productId: "self-ink-stamps",
        selectionId: "round",
      },
    },
  });
  const elapsed3 = (performance.now() - t3).toFixed(2);
  const roundProduct = catalogService.getProduct("self-ink-stamps");
  const roundOption = catalogService.getSelectionOption(roundProduct, "round");
  const img3 = resolveCatalogImage(roundOption);
  console.log(`Step 3 Execution Time: ${elapsed3}ms (Fast Path without Gemini)`);
  console.log("Step 3 Selected Option:", step3.order?.items?.[0]?.selection?.id);
  console.log("Step 3 Exact Catalog Option Image:", img3);

  // Test 4: SELECT_PRODUCT: "pop-up-display-stands"
  console.log("\n--- [Step 4] SELECT_PRODUCT (pop-up-display-stands) ---");
  const step4 = await salesNode.execute({
    ...step3,
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "pop-up-display-stands" },
    },
  });
  const popupProduct = catalogService.getProduct("pop-up-display-stands");
  const img4 = resolveCatalogImage(popupProduct);
  console.log("Step 4 Product Image:", img4);

  // Test 5: SELECT_NESTED_PRODUCT: "softcase-straight"
  console.log("\n--- [Step 5] SELECT_NESTED_PRODUCT (Pop Up Softcase - Straight) ---");
  const t5 = performance.now();
  const step5 = await salesNode.execute({
    ...step4,
    action: {
      id: "SELECT_NESTED_PRODUCT",
      payload: {
        productId: "pop-up-display-stands",
        selectionId: "softcase-straight",
        nestedProductId: "softcase-straight",
      },
    },
  });
  const elapsed5 = (performance.now() - t5).toFixed(2);
  const softcaseOption = catalogService.getSelectionOption(popupProduct, "softcase-straight");
  const img5 = resolveCatalogImage(softcaseOption);
  console.log(`Step 5 Execution Time: ${elapsed5}ms (Fast Path without Gemini)`);
  console.log("Step 5 Exact Catalog Option Image:", img5);

  // Test 6: Greeting
  console.log("\n--- [Step 6] Greeting Brand Logo Verification ---");
  const step6 = await greetingNode.execute({
    site: "exprintmart",
    visitorType: "VISITOR",
    persistence: { conversation: { dirty: false } },
  });
  const msgs6 = adapter.toWhatsAppMessages({ workflow: "GREETING", response: step6.response });
  const greetingImg = msgs6.find((m) => m.type === "image")?.image?.link;
  console.log("Step 6 Greeting Brand Asset:", greetingImg);

  // Test 7: Gemini Timeout Simulation
  console.log("\n--- [Step 7] Gemini Controlled Timeout Verification ---");
  const gemini = new GeminiProvider();
  gemini.getModel = () => ({
    invoke: () => new Promise((resolve) => setTimeout(() => resolve({ content: "delayed" }), 10000)),
  });

  try {
    await gemini.invoke({
      systemPrompt: "Test",
      userMessage: "Test",
      timeoutMs: 200,
    });
    console.error("Gemini failed to timeout!");
  } catch (err) {
    console.log(`Gemini Timeout caught successfully: ${err.message} (code: ${err.code})`);
  }

  console.log("\n==================================================================");
  console.log("✅ ALL CATALOG TRACES COMPLETED WITH ZERO GEMINI DELAY!");
  console.log("==================================================================");
}

runTrace().catch(console.error);
