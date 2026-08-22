import { GREETING_PATTERNS } from "../utils/RoutingConstants.js";

export default class GreetingClassifier {
  classify(state) {
    const message = (state.userMessage ?? "").trim().toLowerCase();

    if (!message) {
      return null;
    }

    if (!GREETING_PATTERNS.some((pattern) => pattern.test(message))) {
      return null;
    }

    return {
      capability: "greeting",
      confidence: 1,
      source: "RULE",
    };
  }
}
