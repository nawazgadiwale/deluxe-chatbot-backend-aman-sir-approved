import SalesCatalogService from "../sales/services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class DiscoveryEngine {
  async generate(state = {}) {
    const query = String(state.userMessage ?? "").trim();

    console.log("========== DISCOVERY ==========");
    console.log("Query:", query);

    if (!query) {
      return {
        products: [],
        match: null,
        type: "EMPTY",
      };
    }

    const products = catalogService.findProducts(query);

    if (products.length === 1) {
      return {
        products,
        match: products[0],
        type: "EXACT",
      };
    }

    if (products.length > 1) {
      return {
        products,
        match: null,
        type: "AMBIGUOUS",
      };
    }

    return {
      products: [],
      match: null,
      type: "NONE",
    };
  }
}