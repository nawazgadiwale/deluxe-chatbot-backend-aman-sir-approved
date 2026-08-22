export default class ContextBuilder {
  constructor(options = {}) {
    this.maxContextLength = options.maxContextLength ?? 2000;
    this.maxDocuments = options.maxDocuments ?? 3;
    this.maxDocumentLength = options.maxDocumentLength ?? 500;
  }

  build(documents = []) {
    if (!Array.isArray(documents) || documents.length === 0) {
      return "";
    }

    const uniqueDocuments = this.removeDuplicates(documents)
      .filter((document) => document.metadata?.isActive !== false)
      .sort(this.sortByScore)
      .slice(0, this.maxDocuments);

    const sections = [];
    let currentLength = 0;

    for (const document of uniqueDocuments) {
      const section = this.formatDocument(document);

      if (currentLength + section.length > this.maxContextLength) {
        break;
      }

      sections.push(section);

      currentLength += section.length;
    }

    return sections.join("\n\n----------------------------------------\n\n");
  }

  removeDuplicates(documents) {
    const seen = new Set();

    return documents.filter((document) => {
      const id = document.metadata?.id ?? document.pageContent;

      if (seen.has(id)) {
        return false;
      }

      seen.add(id);

      return true;
    });
  }

  sortByScore(a, b) {
    const scoreA = a.metadata?.score ?? 0;
    const scoreB = b.metadata?.score ?? 0;

    return scoreB - scoreA;
  }

  formatDocument(document) {
    const metadata = document.metadata ?? {};

    const content = document.pageContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, this.maxDocumentLength);

    const lines = [];

    if (metadata.product) {
      lines.push(`Product: ${metadata.product}`);
    }

    if (metadata.mainCategory) {
      lines.push(`Category: ${metadata.mainCategory}`);
    }

    if (metadata.subCategory) {
      lines.push(`Sub Category: ${metadata.subCategory}`);
    }

    if (metadata.relatedProducts?.length) {
      lines.push(`Related Products: ${metadata.relatedProducts.join(", ")}`);
    }

    if (metadata.frequentlyBoughtWith?.length) {
      lines.push(
        `Frequently Bought With: ${metadata.frequentlyBoughtWith.join(", ")}`,
      );
    }

    if (metadata.keywords?.length) {
      lines.push(`Keywords: ${metadata.keywords.join(", ")}`);
    }

    lines.push(`Description: ${content}`);

    return lines.join("\n");
  }
}
