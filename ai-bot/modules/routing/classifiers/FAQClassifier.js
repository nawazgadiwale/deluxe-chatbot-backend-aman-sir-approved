import { FAQ_PATTERNS, SERVICE_PATTERNS } from "../utils/RoutingConstants.js";

export default class FAQClassifier {
  classify(state) {
    const message = (state.userMessage ?? "").trim().toLowerCase();
    if (!message) return null;

    if (FAQ_PATTERNS.some((pattern) => pattern.test(message))) {
      return { capability: "faq", confidence: 1, source: "RULE" };
    }

    if (SERVICE_PATTERNS.some((pattern) => pattern.test(message))) {
      return { capability: "faq", confidence: 0.95, source: "RULE" };
    }

    return null;
  }
}
