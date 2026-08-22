import { Document } from "@langchain/core/documents";
import MetadataNormalizer from "./MetadataNormalizer.js";

const metadataNormalizer = new MetadataNormalizer();

export default class DocumentNormalizer {
  normalize(documents = [], sourceType) {
    return documents.map(
      (document) =>
        new Document({
          pageContent: this.normalizeContent(document.pageContent),

          metadata: metadataNormalizer.normalize(document.metadata, sourceType),
        }),
    );
  }

  normalizeContent(content = "") {
    return content
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
