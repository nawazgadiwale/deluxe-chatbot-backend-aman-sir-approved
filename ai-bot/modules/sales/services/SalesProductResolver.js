import SalesCatalogService from "../services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class SalesProductResolver {
  resolve(message = "") {
    if (!message.trim()) {
      return null;
    }

    return catalogService.findProduct(message);
  }

  resolveMany(message = "") {
    if (!message.trim()) {
      return [];
    }

    return catalogService.findProducts(message);
  }
}
