import SemanticRetriever from "./SemanticRetriever.js";
import BM25Retriever from "./BM25Retriever.js";
import ReciprocalRankFusion from "../rankers/RRFRanker.js";

const semanticRetriever = new SemanticRetriever();

// Enable BM25 when available
const keywordRetriever = new BM25Retriever(null);

const ranker = new ReciprocalRankFusion();

export default class HybridRetriever {
  async retrieve(options = {}) {
    const { query, filter = {}, topK = 5 } = options;

    if (!query) {
      return [];
    }

    /*
     * =====================================================
     * Parallel Retrieval
     * =====================================================
     */

    const [semanticResults, keywordResults] = await Promise.all([
      semanticRetriever.retrieve(query, {
        k: topK,
        filter,
      }),

      keywordRetriever.retrieve(query, {
        k: topK,
      }),
    ]);

    /*
     * =====================================================
     * Hybrid Ranking
     * =====================================================
     */

    const ranked = ranker.fuse([semanticResults, keywordResults]);

    /*
     * =====================================================
     * Remove Duplicate Products
     * One product may have multiple chunks.
     * =====================================================
     */

    const uniqueProducts = new Map();

    for (const document of ranked) {
      const product = document.metadata?.product?.toLowerCase();

      if (!product) {
        continue;
      }

      if (!uniqueProducts.has(product)) {
        uniqueProducts.set(product, document);
      }
    }

    /*
     * =====================================================
     * Highest Score First
     * =====================================================
     */

    const products = [...uniqueProducts.values()]
      .sort(
        (a, b) => (b.metadata?.fusedScore ?? 0) - (a.metadata?.fusedScore ?? 0),
      )
      .slice(0, topK);

    return products;
  }
}
