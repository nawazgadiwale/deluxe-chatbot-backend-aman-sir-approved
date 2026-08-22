// import fs from "node:fs/promises";
// import path from "node:path";

// import { Document } from "@langchain/core/documents";

// export default class CatalogLoader {
//   constructor(catalogPath) {
//     this.catalogPath = catalogPath;
//   }

//   async load() {
//     const file = await fs.readFile(path.resolve(this.catalogPath), "utf8");

//     const catalog = JSON.parse(file);

//     const documents = [];

//     for (const item of catalog.documents ?? []) {
//       documents.push(
//         new Document({
//           pageContent: item.content,

//           metadata: {
//             id: item.id,

//             ...(item.metadata ?? {}),

//             source: this.catalogPath,

//             category: "productcatalog",

//             loader: "CatalogLoader",
//           },
//         }),
//       );
//     }

//     return documents;
//   }
// }

import fs from "node:fs/promises";
import path from "node:path";

import { Document } from "@langchain/core/documents";

export default class CatalogLoader {
  constructor(catalogPath) {
    this.catalogPath = catalogPath;
  }

  async load() {
    const file = await fs.readFile(path.resolve(this.catalogPath), "utf8");

    const catalog = JSON.parse(file);

    const documents = [];

    for (const item of catalog.documents ?? []) {
      const metadata = item.metadata ?? {};

      /*
       * ============================================
       * Rich Semantic Content
       * This is what gets embedded into FAISS.
       * ============================================
       */

      const pageContent = [
        `Product: ${metadata.product ?? ""}`,

        `Main Category: ${metadata.mainCategory ?? ""}`,

        `Sub Category: ${metadata.subCategory ?? ""}`,

        `Description: ${item.content ?? ""}`,

        metadata.keywords?.length
          ? `Keywords:\n${metadata.keywords.join("\n")}`
          : "",

        metadata.synonyms?.length
          ? `Synonyms:\n${metadata.synonyms.join("\n")}`
          : "",

        metadata.industries?.length
          ? `Industries:\n${metadata.industries.join("\n")}`
          : "",

        metadata.businessTypes?.length
          ? `Business Types:\n${metadata.businessTypes.join("\n")}`
          : "",

        metadata.useCases?.length
          ? `Use Cases:\n${metadata.useCases.join("\n")}`
          : "",

        metadata.customerGoals?.length
          ? `Customer Goals:\n${metadata.customerGoals.join("\n")}`
          : "",

        metadata.relatedProducts?.length
          ? `Related Products:\n${metadata.relatedProducts.join("\n")}`
          : "",

        metadata.frequentlyBoughtWith?.length
          ? `Frequently Bought Together:\n${metadata.frequentlyBoughtWith.join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      documents.push(
        new Document({
          pageContent,

          metadata: {
            id: item.id,

            ...metadata,

            source: this.catalogPath,

            category: "productcatalog",

            loader: "CatalogLoader",
          },
        }),
      );
    }

    return documents;
  }
}
