export default class SupportValidator {
  validate(result = {}) {
    if (!result || typeof result !== "object") {
      return {
        answer: "I don't know.",
        references: [],
      };
    }

    const answer =
      typeof result.answer === "string" ? result.answer.trim() : "";

    const references = Array.isArray(result.references)
      ? result.references
          .filter((reference) => typeof reference === "string")
          .map((reference) => reference.trim())
          .filter(Boolean)
      : [];

    return {
      answer: answer || "I don't know.",
      references,
    };
  }
}
