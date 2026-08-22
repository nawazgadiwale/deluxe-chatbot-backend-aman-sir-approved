import ProductDetailsAgent from "../../agents/ProductDetaisAgent.js";

const agent = new ProductDetailsAgent();

export default class ProductDetailsNode {
  async execute(state) {
    return agent.execute(state);
  }
}
