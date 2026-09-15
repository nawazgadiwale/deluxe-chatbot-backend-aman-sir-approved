import SalesCatalogService from "../services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class SalesProductResolver {
  resolve(message = "") {
    const text = String(message).trim();

    if (!text) {
      return null;
    }

    const matches = catalogService.findProducts(text);

    return matches.length === 1 ? matches[0] : null;
  }

  resolveMany(message = "") {
    const text = String(message).trim();

    if (!text) {
      return [];
    }

    return catalogService.findProducts(text);
  }
}