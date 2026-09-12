import SalesCatalogService from "../services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class SalesProductResolver {
  resolve(message = "") {
    if (!message.trim()) {
      return null;
    }

    const matches = catalogService.findProducts(message);
    return matches.length === 1 ? matches[0] : null;
  }

  resolveMany(message = "") {
    if (!message.trim()) {
      return [];
    }

    return catalogService.findProducts(message);
  }
}
