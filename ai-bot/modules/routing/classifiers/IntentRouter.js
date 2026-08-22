import LLMService from "../../../ai/llm/LLMService.js";
import RoutingPrompt from "../../../ai/llm/prompts/RoutingPrompt.js";

import LeadIntentResolver from "../../lead/builders/LeadIntentResolver.js";

import {
  SERVICE_PATTERNS,
  SUPPORT_PATTERNS,
  LEAD_PATTERNS,
  DETAIL_PATTERNS,
  SALES_PATTERNS,
  DISCOVERY_PATTERNS,
} from "../utils/RoutingConstants.js";

const llm = new LLMService();
const leadIntentResolver = new LeadIntentResolver();

export default class IntentRouter {
  async classify(state) {
    const message = (state.userMessage ?? "").trim();

    if (!message) {
      return {
        capability: "out_of_scope",
        confidence: 0,
        source: "RULE",
      };
    }

    const normalized = message.toLowerCase();

    /*
     * =====================================================
     * PRODUCT DETAILS
     * =====================================================
     */

    if (DETAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "product_details",
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * =====================================================
     * SALES
     * =====================================================
     */

    if (SALES_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "sales",
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * =====================================================
     * FAQ
     * =====================================================
     */

    if (SERVICE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "faq",
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * =====================================================
     * SUPPORT
     * =====================================================
     */

    if (SUPPORT_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "support",
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * =====================================================
     * DISCOVERY
     * =====================================================
     */

    if (DISCOVERY_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "discovery",
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * =====================================================
     * LEAD
     * =====================================================
     *
     * LeadIntentResolver determines BOTH:
     *
     * 1. capability
     * 2. requestType
     *
     * Example:
     *
     * "Request quotation"
     *
     * =>
     *
     * {
     *   capability: "lead",
     *   requestType: "QUOTATION"
     * }
     */

    const leadIntent = leadIntentResolver.resolve(message);

    if (leadIntent) {
      return leadIntent;
    }

    /*
     * =====================================================
     * LEGACY LEAD PATTERN FALLBACK
     * =====================================================
     *
     * This preserves your existing LEAD_PATTERNS behavior.
     */

    if (LEAD_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {
        capability: "lead",
        confidence: 1,
        source: "RULE",
      };
    }

    /*
     * =====================================================
     * LLM FALLBACK
     * =====================================================
     */

    const schema = {
      type: "object",

      properties: {
        capability: {
          type: "string",

          enum: [
            "sales",
            "lead",
            "product_details",
            "faq",
            "support",
            "out_of_scope",
          ],
        },

        confidence: {
          type: "number",
        },
      },

      required: ["capability", "confidence"],
    };

    const result = await llm.invokeStructured({
      schema,

      systemPrompt: RoutingPrompt({
        history: state.history ?? [],
        message,
        catalogContext: state.catalogContext ?? {},
      }),

      userMessage: message,
    });

    return {
      capability: result.capability ?? "out_of_scope",
      confidence: Number(result.confidence ?? 0.8),
      source: "LLM",
    };
  }
}
