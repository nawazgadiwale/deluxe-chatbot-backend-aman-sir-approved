import path from "node:path";
import { fileURLToPath } from "node:url";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import DocumentLoader from "../rag/ingestion/loaders/DocumentLoader.js";
import VectorStoreService from "./VectorStoreService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.resolve(__dirname, "../../data");
const VECTOR_STORE_PATH = path.resolve(__dirname, "../../vectorstore");

const vectorStoreService = VectorStoreService.getInstance();
const documentLoader = new DocumentLoader();

async function ingest() {
  console.log("========================================");
  console.log("Building Knowledge Base...");
  console.log("========================================");

  console.log("Loading documents...");

  const rawDocuments = await documentLoader.loadDirectory(DATA_PATH);

  console.log(`Loaded ${rawDocuments.length} documents`);

  if (!rawDocuments.length) {
    throw new Error("No documents found in the data directory.");
  }

  console.log("Splitting documents...");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,
    chunkOverlap: 250,
  });

  const chunks = await splitter.splitDocuments(rawDocuments);

  console.log(`Generated ${chunks.length} chunks`);

  console.log("Creating FAISS index...");

  await vectorStoreService.create(chunks);

  console.log("Saving vector store...");

  await vectorStoreService.save(VECTOR_STORE_PATH);

  console.log("========================================");
  console.log("Knowledge Base Built Successfully");
  console.log("========================================");
  console.log(`Documents : ${rawDocuments.length}`);
  console.log(`Chunks    : ${chunks.length}`);
  console.log(`Saved To  : ${VECTOR_STORE_PATH}`);
  console.log("========================================");
}

ingest().catch((error) => {
  console.error("Knowledge Base Build Failed");
  console.error(error);
  process.exit(1);
});
