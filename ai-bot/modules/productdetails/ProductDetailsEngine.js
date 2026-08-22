import SalesCatalogService from "../sales/services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class ProductDetailsEngine {
  async generate(state) {
    let product = null;

    if (state.action?.payload?.productId) {
      product = catalogService.getProduct(state.action.payload.productId);
    }

    if (!product && state.action?.payload?.product) {
      product = catalogService.findProduct(state.action.payload.product);
    }

    if (!product && state.userMessage) {
      product = catalogService.findProduct(state.userMessage);
    }

    if (!product) {
      return null;
    }

    return {
      context: catalogService.getProductContext(product),
    };
  }
}
