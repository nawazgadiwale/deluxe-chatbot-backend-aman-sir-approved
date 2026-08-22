import SalesCatalogService from "../sales/services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class DiscoveryEngine {
  async generate(state) {
    const query = state.userMessage ?? "";

    console.log("========== DISCOVERY ==========");
    console.log("Query:", query);

    const products = catalogService.discover(query);

    return {
      products,
    };
  }
}
