import QueryNormalizer from "./preprocessors/QueryNormalizer.js";
import ConversationEnricher from "./preprocessors/ConversationEnricher.js";
import FilterBuilder from "./builders/FilterBuilder.js";
import ContextBuilder from "./builders/ContextBuilder.js";

import SemanticRetriever from "./retrievers/SemanticRetriever.js";

import VectorStoreService from "../VectorStoreService.js";

const queryNormalizer = new QueryNormalizer();

const conversationEnricher = new ConversationEnricher();

const filterBuilder = new FilterBuilder();

const contextBuilder = new ContextBuilder();

// Use singleton FAISS instance
const vectorStoreService = VectorStoreService.getInstance();

const retriever = new SemanticRetriever(vectorStoreService);

export default class RAGPipeline {
  async retrieve({ query, conversation = {}, options = {} }) {
    // Normalize Query
    const normalizedQuery = queryNormalizer.normalize(query);

    // Enrich using conversation history
    const enriched = conversationEnricher.enrich(normalizedQuery, conversation);

    // Build metadata filters
    const filters = filterBuilder.build(enriched);

    // Semantic Retrieval (BM25 Disabled)
    const documents = await retriever.retrieve(enriched.enrichedQuery, {
      k: options.topK ?? 3,
      filter: filters,
    });

    // console.log("========== RAG RETRIEVAL ==========");
    // console.log("Query:", enriched.enrichedQuery);
    // console.log(
    //   "Documents:",
    //   documents.map((d) => ({
    //     score: d.score,
    //     source: d.metadata?.source,
    //     text: d.pageContent?.substring(0, 200),
    //   })),
    // );
    // console.log("==================================");

    // Build context for LLM
    const context = contextBuilder.build(documents);

    // console.log("========== CONTEXT ==========");
    // console.log(context);
    // console.log("=============================");

    return {
      originalQuery: query,

      normalizedQuery,

      enrichedQuery: enriched,

      filters,

      documents,

      context,
    };
  }
}
