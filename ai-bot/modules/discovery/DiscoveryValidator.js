export default class DiscoveryValidator {
  validate(result = {}) {
    const products = result.products ?? [];

    return {
      summary:
        products.length > 0
          ? `I found ${products.length} matching products.`
          : "I couldn't find any matching products.",

      followUpQuestion:
        products.length > 0 ? "Select a product to view more details." : "",

      products: products.map((product) => ({
        id: product.id,

        name: product.name,

        slug: product.slug,

        image: product.image,

        thumbnail: product.thumbnail,

        badge: product.badge,

        shortDescription: product.shortDescription ?? product.description ?? "",

        mainCategory: product.mainCategory,

        subCategory: product.subCategory,

        pricing: product.pricing,

        featured: product.featured,

        actions: [
          {
            id: "SHOW_PRODUCT_DETAILS",
            label: "View Details",
            payload: {
              productId: product.id,
            },
          },
        ],
      })),
    };
  }
}
