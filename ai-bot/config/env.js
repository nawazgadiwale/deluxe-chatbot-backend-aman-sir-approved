import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // =====================================
  // Application
  // =====================================

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().default(5000),

  // =====================================
  // Database
  // =====================================

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // =====================================
  // Ollama
  // =====================================

  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),

  OLLAMA_CHAT_MODEL: z.string().default("qwen3:8b"),

  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),

  OLLAMA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),

  // =====================================
  // RAG
  // =====================================

  VECTOR_STORE_PATH: z.string().default("./src/vectorstore"),

  TOP_K: z.coerce.number().positive().default(5),

  // =====================================
  // Logging
  // =====================================

  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid Environment Variables");

  console.error(parsedEnv.error.format());

  process.exit(1);
}

const env = Object.freeze({
  nodeEnv: parsedEnv.data.NODE_ENV,

  port: parsedEnv.data.PORT,

  mongoUri: parsedEnv.data.MONGODB_URI,

  ollama: {
    baseUrl: parsedEnv.data.OLLAMA_BASE_URL,

    chatModel: parsedEnv.data.OLLAMA_CHAT_MODEL,

    embeddingModel: parsedEnv.data.OLLAMA_EMBEDDING_MODEL,

    temperature: parsedEnv.data.OLLAMA_TEMPERATURE,
  },

  rag: {
    vectorStorePath: parsedEnv.data.VECTOR_STORE_PATH,

    topK: parsedEnv.data.TOP_K,
  },

  logLevel: parsedEnv.data.LOG_LEVEL,
});

export default env;
