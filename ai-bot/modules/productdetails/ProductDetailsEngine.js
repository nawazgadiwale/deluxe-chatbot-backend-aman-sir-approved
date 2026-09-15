import SalesCatalogService from "../sales/services/SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class ProductDetailsEngine {
  async generate(state = {}) {
    const product = this.resolveProduct(state);

    if (!product) return null;

    return {
      context: catalogService.getProductContext(product),
    };
  }

  resolveProduct(state = {}) {
    const productId = state.action?.payload?.productId;

    if (productId) return catalogService.getProduct(productId);
    if (state.selectedProduct?.id) {
      return catalogService.getProduct(state.selectedProduct.id);
    }
    if (state.product?.id) {
      return catalogService.getProduct(state.product.id);
    }
    if (state.product) {
      return catalogService.findProduct(state.product);
    }

    return null;
  }
}