import SalesCatalogService from "./SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class UpsellService {
  recommend(requirement = {}) {
    if (!this.shouldRecommend(requirement)) {
      return [];
    }

    const recommendations = [];
    const addedProducts = new Set();

    for (const item of requirement.items ?? []) {
      const relatedProducts = this.getRelatedProducts(item.product);

      for (const product of relatedProducts) {
        if (
          !addedProducts.has(product.id) &&
          !this.isAlreadyAdded(requirement, product.id)
        ) {
          recommendations.push(product);
          addedProducts.add(product.id);
        }
      }
    }

    return recommendations;
  }

  shouldRecommend(requirement = {}) {
    return (requirement.items?.length ?? 0) > 0;
  }

  getRelatedProducts(product = {}) {
    if (!product?.id) {
      return [];
    }

    return catalogService.getRelatedProducts(product.id) ?? [];
  }

  isAlreadyAdded(requirement = {}, productId) {
    return (requirement.items ?? []).some(
      (item) => item.product?.id === productId,
    );
  }
}
