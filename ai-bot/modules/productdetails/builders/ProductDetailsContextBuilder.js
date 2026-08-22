export default class ProductDetailsContextBuilder {
  build(product = {}) {
    const sections = [];

    sections.push(`Product: ${product.name}`);

    sections.push(`Category: ${product.mainCategory}/${product.subCategory}`);

    if (product.shortDescription || product.description) {
      sections.push(
        `Description:\n${product.shortDescription ?? product.description}`,
      );
    }

    if (product.features?.length) {
      sections.push(`Features:\n${product.features.join("\n")}`);
    }

    if (product.fields?.length) {
      sections.push(
        `Fields:\n${product.fields.map((f) => f.label).join(", ")}`,
      );
    }

    if (product.requirements?.length) {
      sections.push(
        `Requirements:\n${product.requirements.map((r) => r.name).join(", ")}`,
      );
    }

    if (product.addons?.options?.length) {
      sections.push(
        `Available Addons:\n${product.addons.options
          .map((a) => a.name)
          .join(", ")}`,
      );
    }

    return sections.join("\n\n");
  }
}
