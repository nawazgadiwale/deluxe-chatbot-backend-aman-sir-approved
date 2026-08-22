import { SUPPORT_KEYWORDS } from "../utils/RoutingConstants.js";

export default class SupportClassifier {
  classify(state) {
    const message = (state.userMessage ?? "").trim().toLowerCase();

    if (!message) {
      return null;
    }

    const matched = SUPPORT_KEYWORDS.some((keyword) =>
      message.includes(keyword),
    );

    if (!matched) {
      return null;
    }

    return {
      capability: "support",
      confidence: 1,
      source: "RULE",
    };
  }
}
