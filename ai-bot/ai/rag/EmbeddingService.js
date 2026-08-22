import { OllamaEmbeddings } from "@langchain/ollama";

export default class EmbeddingService {
  #embeddingModel;

  constructor() {
    this.#embeddingModel = new OllamaEmbeddings({
      model: "nomic-embed-text",
    });
  }

  /**
   * Returns the LangChain embedding model.
   */
  getEmbeddingModel() {
    return this.#embeddingModel;
  }

  /**
   * Generates an embedding for a user query.
   */
  async embedQuery(query) {
    console.time("Embedding");

    const result = await this.#embeddingModel.embedQuery(query);

    console.timeEnd("Embedding");

    return result;
  }

  /**
   * Generates embeddings for multiple text chunks.
   */
  async embedDocuments(texts = []) {
    if (!Array.isArray(texts)) {
      throw new Error("Documents must be an array.");
    }

    if (texts.length === 0) {
      return [];
    }

    return this.#embeddingModel.embedDocuments(texts);
  }
}
