import { FAQ_PATTERNS, SERVICE_PATTERNS } from "../utils/RoutingConstants.js";

export default class FAQClassifier {
  classify(state) {
    const message = (state.userMessage ?? "").trim().toLowerCase();

    if (!message) {
      return null;
    }

    // Exact FAQ questions
    if (FAQ_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        capability: "faq",
        confidence: 1,
        source: "RULE",
      };
    }

    // Service-related questions anywhere in the sentence
    if (SERVICE_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        capability: "faq",
        confidence: 0.95,
        source: "RULE",
      };
    }

    return null;
  }
}
