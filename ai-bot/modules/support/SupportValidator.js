export default class SupportValidator {
  validate(result = {}) {
    return {
      answer: result.answer?.trim() || "I don't know.",

      references: Array.isArray(result.references) ? result.references : [],

      followUpQuestion: result.followUpQuestion?.trim() || "",
    };
  }
}
