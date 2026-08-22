import SupportEngine from "./SupportEngine.js";
import SupportValidator from "./SupportValidator.js";

const engine = new SupportEngine();
const validator = new SupportValidator();

export default class SupportService {
  async generate(state) {
    const result = await engine.generate(state);

    return {
      context: result.context,
      documents: result.documents,
      answer: validator.validate(result.response),
    };
  }
}
