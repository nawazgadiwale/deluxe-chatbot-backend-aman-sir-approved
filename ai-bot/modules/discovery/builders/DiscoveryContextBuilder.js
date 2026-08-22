export default class DiscoveryContextBuilder {
  build(products = []) {
    return products
      .map((product, index) => {
        return `
${index + 1}. ${product.name}
Category: ${product.mainCategory} / ${product.subCategory}
${product.shortDescription ?? product.description ?? ""}
`;
      })
      .join("\n");
  }
}
