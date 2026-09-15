import SupportEngine from "./SupportEngine.js";
import SupportValidator from "./SupportValidator.js";

const engine = new SupportEngine();
const validator = new SupportValidator();

export default class SupportService {
  async generate(state = {}) {
    const result = await engine.generate(state);
    const validated = validator.validate(result.response);

    return {
      context: result.context ?? "",
      documents: Array.isArray(result.documents)
        ? result.documents
        : [],

      answer: validated.answer,
      references: validated.references,

      metadata: result.metadata ?? {},
    };
  }
}