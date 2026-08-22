import SalesCatalogService from "../../sales/services/SalesCatalogService.js";
import LLMService from "../../../ai/llm/LLMService.js";

import {
  SALES_PATTERNS,
  DETAIL_PATTERNS,
  DISCOVERY_PATTERNS,
} from "../utils/RoutingConstants.js";

const catalog = new SalesCatalogService();
const llm = new LLMService();

export default class SemanticProductRouter {
  async classify(state) {
    const message = (state.userMessage ?? "").trim();
    const normalized = message.toLowerCase();

    // =====================================================
    // RESOLVE PRODUCT FROM SALES CATALOG
    // =====================================================

    const products = catalog.findProducts(message);

    const catalogContext = {
      products,
    };

    // =====================================================
    // NO PRODUCT FOUND
    // =====================================================

    if (!catalogContext.products?.length) {
      return null;
    }

    // =====================================================
    // SALES
    // =====================================================

    if (
      SALES_PATTERNS.some((pattern) => pattern.test(normalized)) ||
      /\b\d+\b/.test(normalized)
    ) {
      return {
        capability: "sales",
        confidence: 1,
        source: "RULE",
      };
    }

    // =====================================================
    // PRODUCT DETAILS
    // =====================================================

    if (DETAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "product_details",
        confidence: 1,
        source: "RULE",
      };
    }

    // =====================================================
    // DISCOVERY
    // =====================================================

    const product = catalogContext.products[0];

    const productName = product?.name?.toLowerCase() ?? "";

    if (
      normalized === productName ||
      DISCOVERY_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      return {
        capability: "discovery",
        confidence: 1,
        source: "RULE",
      };
    }

    // =====================================================
    // TINY LLM FALLBACK
    // =====================================================

    const schema = {
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

    const result = await llm.invokeStructured({
      schema,

      systemPrompt: `
You are a product intent classifier.

Known Products:
${catalogContext.products.map((p) => p.name).join(", ")}

Return ONLY valid JSON.

Choose ONE capability.

sales
- customer wants to buy a product
- customer wants to order
- customer wants quantity
- customer wants checkout

product_details
- asks about material
- price
- size
- specifications
- printing options

none
- message is NOT about buying a product
- message is about contacting sales
- message is about talking to an expert
- message is about support
- greeting
- anything unrelated to product purchase
`,

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
  }
}
