import vectorStore from "../../VectorStore.js";

export default class SemanticRetriever {
  constructor() {
    this.retrieverCache = new Map();
  }

  getRetriever(options = {}) {
    const key = JSON.stringify({
      k: options.k ?? 4,
      filter: options.filter,
    });

    if (!this.retrieverCache.has(key)) {
      this.retrieverCache.set(
        key,
        vectorStore.asRetriever({
          k: options.k ?? 4,
          filter: options.filter,
        }),
      );
    }

    return this.retrieverCache.get(key);
  }

  async retrieve(query, options = {}) {
    const retriever = this.getRetriever(options);

    console.time("Semantic Invoke");

    const docs = await retriever.invoke(query);

    console.timeEnd("Semantic Invoke");

    return docs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        retrievalMethod: "semantic",
      },
    }));
  }
}
