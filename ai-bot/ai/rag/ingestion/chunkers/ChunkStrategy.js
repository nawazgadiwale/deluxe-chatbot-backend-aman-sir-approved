import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export default class ChunkStrategy {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize ?? 800;

    this.chunkOverlap = options.chunkOverlap ?? 150;

    this.defaultSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      separators: ["\n\n", "\n", ". ", "! ", "? ", ";", ",", " ", ""],
    });
  }

  getSplitter(sourceType = "") {
    switch (sourceType.toLowerCase()) {
      // Structured data should never be chunked
      case "catalog":
        return null;

      // Unstructured text
      case "companydata":
      case "companypolicy":
      case "companywebsite":
      case "website":
      case "pdf":
      case "doc":
      case "docx":
      case "markdown":
      case "md":
      case "text":
      case "txt":
      default:
        return this.defaultSplitter;
    }
  }
}
