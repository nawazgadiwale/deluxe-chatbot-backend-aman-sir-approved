export default class ReciprocalRankFusion {
  constructor(options = {}) {
    this.k = options.k ?? 50;
    this.topK = options.topK ?? 5;
  }

  /*
   * =====================================================
   * Reciprocal Rank Fusion
   * =====================================================
   */

  fuse(rankings = []) {
    const results = new Map();

    rankings.forEach((documents = []) => {
      documents.forEach((document, index) => {
        if (!document) return;

        const id = this.getDocumentId(document);

        if (!id) return;

        const rrfScore = 1 / (this.k + index + 1);

        if (!results.has(id)) {
          results.set(id, {
            score: rrfScore,
            document: this.decorate(document),
            catalogRank:
              document.metadata?.retrievalMethod === "CATALOG"
                ? index + 1
                : null,
            semanticRank:
              document.metadata?.retrievalMethod === "SEMANTIC"
                ? index + 1
                : null,
          });

          return;
        }

        const existing = results.get(id);

        existing.score += rrfScore;

        if (
          document.metadata?.retrievalMethod === "CATALOG" &&
          existing.catalogRank == null
        ) {
          existing.catalogRank = index + 1;
        }

        if (
          document.metadata?.retrievalMethod === "SEMANTIC" &&
          existing.semanticRank == null
        ) {
          existing.semanticRank = index + 1;
        }

        existing.document = this.mergeDocument(existing.document, document);
      });
    });

    return [...results.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topK)
      .map((entry) => ({
        pageContent: entry.document.pageContent,

        metadata: {
          ...entry.document.metadata,

          hybridScore: Number(entry.score.toFixed(6)),

          catalogRank: entry.catalogRank,

          semanticRank: entry.semanticRank,

          retrievalMethods: entry.document.metadata.retrievalMethods ?? [],
        },
      }));
  }

  /*
   * =====================================================
   * Document Identifier
   * =====================================================
   */

  getDocumentId(document) {
    return (
      document.metadata?.product?.toLowerCase() ??
      document.metadata?.id ??
      document.metadata?.source ??
      document.pageContent
    );
  }

  /*
   * =====================================================
   * Decorate
   * =====================================================
   */

  decorate(document) {
    return {
      ...document,

      metadata: {
        ...document.metadata,

        retrievalMethods: [document.metadata?.retrievalMethod].filter(Boolean),
      },
    };
  }

  /*
   * =====================================================
   * Merge
   * =====================================================
   */

  mergeDocument(existing, incoming) {
    const methods = new Set([
      ...(existing.metadata?.retrievalMethods ?? []),
      ...(incoming.metadata?.retrievalMethods ?? []),
      incoming.metadata?.retrievalMethod,
    ]);

    return {
      ...existing,

      pageContent:
        existing.pageContent.length >= incoming.pageContent.length
          ? existing.pageContent
          : incoming.pageContent,

      metadata: {
        ...existing.metadata,
        ...incoming.metadata,

        retrievalMethods: [...methods],
      },
    };
  }
}
