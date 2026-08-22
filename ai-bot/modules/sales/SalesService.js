import SalesBrain from "./SalesBrain.js";
import SalesValidator from "./SalesValidator.js";

const brain = new SalesBrain();
const validator = new SalesValidator();

export default class SalesService {
  async execute(state = {}) {
    const result = await brain.execute(state);

    return validator.validate(result);
  }

  generate(state = {}) {
    return this.execute(state);
  }
}
