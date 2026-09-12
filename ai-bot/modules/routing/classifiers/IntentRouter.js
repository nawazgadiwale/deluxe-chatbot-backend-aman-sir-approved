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

const ROUTING_SCHEMA = {
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

export default class IntentRouter {
  async classify(state) {
    const message = (state.userMessage ?? "").trim();
    if (!message) {
      return { capability: "out_of_scope", confidence: 0, source: "RULE" };
    }

    const normalized = message.toLowerCase();

    // 1. Product details
    if (DETAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "product_details", confidence: 1, source: "RULE" };
    }

    // 2. Sales
    if (SALES_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "sales", confidence: 1, source: "RULE" };
    }

    // 3. FAQ / Service
    if (SERVICE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "faq", confidence: 1, source: "RULE" };
    }

    // 4. Support
    if (SUPPORT_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "support", confidence: 1, source: "RULE" };
    }

    // 5. Discovery
    if (DISCOVERY_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "discovery", confidence: 1, source: "RULE" };
    }

    // 6. Lead intent resolution (determines capability + requestType)
    const leadIntent = leadIntentResolver.resolve(message);
    if (leadIntent) {
      return leadIntent;
    }

    // 7. Lead patterns fallback
    if (LEAD_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { capability: "lead", confidence: 1, source: "RULE" };
    }

    // 8. LLM fallback
    try {
      const result = await llm.invokeStructured({
        schema: ROUTING_SCHEMA,
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
    } catch {
      return {
        capability: "out_of_scope",
        confidence: 0,
        source: "FALLBACK",
      };
    }
  }
}
