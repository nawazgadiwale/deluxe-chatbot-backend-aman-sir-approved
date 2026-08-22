import fs from "node:fs/promises";
import path from "node:path";

import { FaissStore } from "@langchain/community/vectorstores/faiss";

import EmbeddingService from "./EmbeddingService.js";

const embeddingService = new EmbeddingService();

class VectorStoreService {
  static #instance = null;

  static getInstance() {
    if (!VectorStoreService.#instance) {
      VectorStoreService.#instance = new VectorStoreService();
    }

    return VectorStoreService.#instance;
  }

  #embeddingModel;

  #vectorStore = null;

  constructor() {
    if (VectorStoreService.#instance) {
      return VectorStoreService.#instance;
    }

    this.#embeddingModel = embeddingService.getEmbeddingModel();

    VectorStoreService.#instance = this;
  }

  /**
   * Create a new FAISS index
   */
  async create(documents = []) {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error("Documents are required.");
    }

    this.#vectorStore = await FaissStore.fromDocuments(
      documents,
      this.#embeddingModel,
    );

    return this.#vectorStore;
  }

  /**
   * Load an existing FAISS index
   */
  async load(directory) {
    if (this.#vectorStore) {
      return this.#vectorStore;
    }

    const resolvedPath = path.resolve(directory);

    this.#vectorStore = await FaissStore.load(
      resolvedPath,
      this.#embeddingModel,
    );

    return this.#vectorStore;
  }

  /**
   * Save current index
   */
  async save(directory) {
    if (!this.#vectorStore) {
      throw new Error("Vector store has not been initialized.");
    }

    const resolvedPath = path.resolve(directory);

    await fs.mkdir(resolvedPath, {
      recursive: true,
    });

    await this.#vectorStore.save(resolvedPath);
  }

  /**
   * Add documents
   */
  async addDocuments(documents = []) {
    if (!this.#vectorStore) {
      throw new Error("Vector store has not been initialized.");
    }

    if (!documents.length) {
      return;
    }

    await this.#vectorStore.addDocuments(documents);
  }

  /**
   * Get underlying vector store
   */
  getVectorStore() {
    return this.#vectorStore;
  }

  /**
   * Get retriever
   */
  asRetriever(options = {}) {
    if (!this.#vectorStore) {
      throw new Error("Vector store has not been initialized.");
    }

    return this.#vectorStore.asRetriever({
      k: Number(options.k ?? 5),
      filter: options.filter,
    });
  }

  isLoaded() {
    return this.#vectorStore !== null;
  }

  async exists(directory) {
    try {
      await fs.access(path.resolve(directory));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    this.#vectorStore = null;
  }
}

export default VectorStoreService;
