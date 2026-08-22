// import crypto from "node:crypto";

// export default class MetadataNormalizer {
//   normalize(metadata = {}, sourceType = "unknown") {
//     return {
//       id: metadata.id ?? crypto.randomUUID(),

//       sourceType,

//       documentType: metadata.documentType ?? this.getDocumentType(sourceType),

//       source: this.getSource(metadata),

//       title: this.getTitle(metadata),

//       filename: metadata.filename ?? null,

//       file: metadata.file ?? null,

//       category: metadata.category ?? null,

//       relativePath: metadata.relativePath ?? null,

//       directory: metadata.directory ?? null,

//       extension: metadata.extension ?? null,

//       loader: metadata.loader ?? null,

//       url: this.getUrl(metadata),

//       page: this.getPage(metadata),

//       mainCategory: metadata.mainCategory ?? null,

//       subCategory: metadata.subCategory ?? null,

//       product: metadata.product ?? null,

//       businessType: metadata.businessType ?? null,

//       department: metadata.department ?? null,

//       language: metadata.language ?? "en",

//       tags: this.getTags(metadata),

//       priority: metadata.priority ?? 1,

//       version: metadata.version ?? "1.0",

//       isActive: metadata.isActive ?? true,

//       createdAt: metadata.createdAt ?? new Date().toISOString(),
//     };
//   }

//   getSource(metadata) {
//     return metadata.source ?? metadata.loc?.source ?? null;
//   }

//   getTitle(metadata) {
//     return metadata.title ?? metadata.product ?? metadata.filename ?? null;
//   }

//   getUrl(metadata) {
//     return metadata.url ?? metadata.loc?.source ?? null;
//   }

//   getPage(metadata) {
//     return metadata.page ?? metadata.loc?.pageNumber ?? null;
//   }

//   getTags(metadata) {
//     return Array.isArray(metadata.tags) ? metadata.tags : [];
//   }

//   getDocumentType(sourceType) {
//     switch (sourceType.toLowerCase()) {
//       case "companywebsite":
//       case "website":
//         return "website";

//       case "companypolicy":
//         return "policy";

//       case "companydata":
//         return "company";

//       case "catalog":
//         return "product";

//       case "pdf":
//         return "brochure";

//       default:
//         return "document";
//     }
//   }
// }

// new updated normalizer

import crypto from "node:crypto";

export default class MetadataNormalizer {
  normalize(metadata = {}, sourceType = "unknown") {
    return {
      /*
       * ==========================================
       * Identity
       * ==========================================
       */

      id: metadata.id ?? crypto.randomUUID(),

      sourceType,

      documentType: metadata.documentType ?? this.getDocumentType(sourceType),

      /*
       * ==========================================
       * Source
       * ==========================================
       */

      source: this.getSource(metadata),

      title: this.getTitle(metadata),

      filename: metadata.filename ?? null,

      file: metadata.file ?? null,

      category: metadata.category ?? null,

      relativePath: metadata.relativePath ?? null,

      directory: metadata.directory ?? null,

      extension: metadata.extension ?? null,

      loader: metadata.loader ?? null,

      url: this.getUrl(metadata),

      page: this.getPage(metadata),

      /*
       * ==========================================
       * Catalog
       * ==========================================
       */

      mainCategory: metadata.mainCategory ?? null,

      subCategory: metadata.subCategory ?? null,

      product: metadata.product ?? null,

      /*
       * ==========================================
       * Rich Catalog Metadata
       * ==========================================
       */

      keywords: this.normalizeArray(metadata.keywords),

      synonyms: this.normalizeArray(metadata.synonyms),

      industries: this.normalizeArray(metadata.industries),

      businessTypes: this.normalizeArray(metadata.businessTypes),

      useCases: this.normalizeArray(metadata.useCases),

      customerGoals: this.normalizeArray(metadata.customerGoals),

      relatedProducts: this.normalizeArray(metadata.relatedProducts),

      frequentlyBoughtWith: this.normalizeArray(metadata.frequentlyBoughtWith),

      /*
       * ==========================================
       * Generic Metadata
       * ==========================================
       */

      businessType: metadata.businessType ?? null,

      department: metadata.department ?? null,

      language: metadata.language ?? "en",

      tags: this.normalizeArray(metadata.tags),

      priority: metadata.priority ?? 1,

      version: metadata.version ?? "1.0",

      isActive: metadata.isActive ?? true,

      createdAt: metadata.createdAt ?? new Date().toISOString(),
    };
  }

  /*
   * ==========================================
   * Helpers
   * ==========================================
   */

  normalizeArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(Boolean).map((item) => String(item).trim());
  }

  getSource(metadata) {
    return metadata.source ?? metadata.loc?.source ?? null;
  }

  getTitle(metadata) {
    return metadata.title ?? metadata.product ?? metadata.filename ?? null;
  }

  getUrl(metadata) {
    return metadata.url ?? metadata.loc?.source ?? null;
  }

  getPage(metadata) {
    return metadata.page ?? metadata.loc?.pageNumber ?? null;
  }

  getDocumentType(sourceType) {
    switch (sourceType.toLowerCase()) {
      case "companywebsite":
      case "website":
        return "website";

      case "companypolicy":
        return "policy";

      case "companydata":
        return "company";

      case "catalog":
        return "product";

      case "pdf":
        return "brochure";

      default:
        return "document";
    }
  }
}
