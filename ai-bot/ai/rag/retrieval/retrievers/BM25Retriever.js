export default class BM25Retriever {
  #retriever;

  constructor(retriever) {
    this.#retriever = retriever;
  }

  /**
   * Performs keyword retrieval.
   *
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Document[]>}
   */
  async retrieve(query, options = {}) {
    if (!query) {
      return [];
    }

    const documents = await this.#retriever.invoke(query);

    return documents.slice(0, options.k ?? 10).map((document) => ({
      ...document,

      metadata: {
        ...document.metadata,

        retrievalMethod: "bm25",
      },
    }));
  }
}
