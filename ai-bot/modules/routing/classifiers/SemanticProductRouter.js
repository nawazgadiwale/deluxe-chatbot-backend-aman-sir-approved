import SalesCatalogService from "../../sales/services/SalesCatalogService.js";
import LLMService from "../../../ai/llm/LLMService.js";
import {
  SALES_PATTERNS,
  DETAIL_PATTERNS,
  DISCOVERY_PATTERNS,
} from "../utils/RoutingConstants.js";

const catalog = new SalesCatalogService();
const llm = new LLMService();

const LLM_SCHEMA = {
  type: "object",
  properties: {
    capability: {
      type: "string",
      enum: ["sales", "product_details", "none"],
    },
    confidence: {
      type: "number",
    },
  },
  required: ["capability", "confidence"],
};

export default class SemanticProductRouter {
  async classify(state) {
    const message = (state.userMessage ?? "").trim();
    const normalized = message.toLowerCase();

    const products = catalog.findProducts(message);
    if (!products?.length) {
      return null;
    }

    // 1. Sales intent
    if (
      SALES_PATTERNS.some((pattern) => pattern.test(normalized)) ||
      /\b(want|need|looking for|require|get|print|order|buy|purchase|quote)\b/i.test(
        normalized,
      ) ||
      /\b\d+\b/.test(normalized)
    ) {
      return { capability: "sales", confidence: 1, source: "RULE" };
    }

    // 2. Product details intent
    if (DETAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "product_details", confidence: 1, source: "RULE" };
    }

    // 3. Discovery intent
    const product = products[0];
    const productName = product?.name?.toLowerCase() ?? "";
    if (
      normalized === productName ||
      DISCOVERY_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      return { capability: "discovery", confidence: 1, source: "RULE" };
    }

    // 4. Structured LLM classification fallback
    try {
      const result = await llm.invokeStructured({
        schema: LLM_SCHEMA,
        systemPrompt: `You are a product intent classifier.
Known Products: ${products.map((p) => p.name).join(", ")}
Return ONLY valid JSON.
Choose ONE capability:
- sales: customer wants to buy, order, needs quantity, or checkout
- product_details: asks about material, price, size, specifications, options
- none: unrelated to buying a product (greeting, support, etc.)`,
        userMessage: message,
      });

      if (result.capability === "none") {
        return null;
      }

      return {
        capability: result.capability,
        confidence: Number(result.confidence ?? 0.8),
        source: "LLM_PRODUCT",
      };
    } catch {
      return {
        capability: "sales",
        confidence: 0.8,
        source: "FALLBACK_SALES",
      };
    }
  }
}
