import ProductDetailsEngine from "./ProductDetailsEngine.js";
import ProductDetailsValidator from "./ProductDetailsValidator.js";

const engine = new ProductDetailsEngine();
const validator = new ProductDetailsValidator();

export default class ProductDetailsService {
  async generate(state) {
    const result = await engine.generate(state);

    return validator.validate(result);
  }
}
