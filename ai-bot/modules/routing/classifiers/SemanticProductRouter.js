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
  async classify(state = {}) {
    const message = String(state.userMessage ?? "").trim();

    if (!message) {
      return null;
    }

    const normalized = message.toLowerCase();
    const products = catalog.findProducts(message);

    if (!products?.length) {
      return null;
    }

    /*
     * ============================================================
     * PRODUCT-SPECIFIC INTENT
     * ============================================================
     *
     * A unique catalog match is already enough to enter Sales.
     *
     * Example:
     *   "business cards"
     *   "buisnes card"
     *   "I need business cards"
     *
     * SalesBrain will perform the actual product selection.
     *
     * Do NOT route these to DiscoveryNode.
     */

    // 1. Product details
    if (DETAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "product_details",
        capabilities: ["product_details"],
        confidence: 1,
        source: "RULE",
      };
    }

    // 2. Explicit sales / order intent
    if (
      SALES_PATTERNS.some((pattern) => pattern.test(normalized)) ||
      /\b(want|need|looking for|require|get|print|order|buy|purchase|quote)\b/i.test(
        normalized,
      ) ||
      /\b\d+\b/.test(normalized)
    ) {
      return {
        capability: "sales",
        capabilities: ["sales"],
        confidence: 1,
        source: "RULE",
        workflow: "SALES",
        step: null,
        action: null,
      };
    }

    /*
     * ============================================================
     * UNIQUE PRODUCT DISCOVERY
     * ============================================================
     *
     * "business cards" is not merely a discovery/search request.
     * It is an unambiguous request for a catalog product.
     *
     * Route directly into SalesNode so SalesBrain can select it
     * and continue with its product-specific configuration.
     */

    if (products.length === 1) {
      return {
        capability: "sales",
        capabilities: ["sales"],
        confidence: 1,
        source: "PRODUCT_DISCOVERY",
        workflow: "SALES",
        step: null,
        action: null,
      };
    }

    /*
     * ============================================================
     * AMBIGUOUS PRODUCT MATCH
     * ============================================================
     *
     * Do not guess.
     * Keep ambiguous discovery separate so it can ask for
     * clarification instead of selecting the wrong product.
     */

    if (products.length > 1) {
      return {
        capability: "discovery",
        capabilities: ["discovery"],
        confidence: 1,
        source: "PRODUCT_DISCOVERY",
        workflow: null,
        step: null,
      };
    }

    /*
     * ============================================================
     * EXPLICIT DISCOVERY LANGUAGE
     * ============================================================
     */

    if (
      DISCOVERY_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      return {
        capability: "discovery",
        capabilities: ["discovery"],
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * ============================================================
     * STRUCTURED LLM FALLBACK
     * ============================================================
     */

    try {
      const result = await llm.invokeStructured({
        schema: LLM_SCHEMA,
        systemPrompt: `You are a product intent classifier.

Known Products:
${products.map((product) => product.name).join(", ")}

Return ONLY valid JSON.

Choose ONE capability:

- sales: customer wants to buy, order, needs quantity, or checkout
- product_details: customer asks about material, price, size, specifications, or options
- none: unrelated to buying a product

Do not invent products.`,
        userMessage: message,
      });

      if (result.capability === "none") {
        return null;
      }

      return {
        capability: result.capability,
        capabilities: [result.capability],
        confidence: Number(result.confidence ?? 0.8),
        source: "LLM_PRODUCT",
      };
    } catch {
      return {
        capability: "sales",
        capabilities: ["sales"],
        confidence: 0.8,
        source: "FALLBACK_SALES",
        workflow: "SALES",
        step: null,
        action: null,
      };
    }
  }
}