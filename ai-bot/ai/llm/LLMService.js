import { Ollama } from "@langchain/ollama";
import GroqProvider from "./providers/GroqProvider.js";
import OllamaProvider from "./providers/OllamaProvider.js";
// import OpenAIProvider from "./providers/OpenAIProvider.js";

let provider;

switch (process.env.LLM_PROVIDER || "Ollama") {
  case "groq":
    provider = new GroqProvider();
    break;

  case "ollama":
    provider = new OllamaProvider();
    break;

  default:
    throw new Error("Unsupported provider");
}

export default class LLMService {
  async invoke(options) {
    return provider.invoke(options);
  }

  async invokeStructured(options) {
    return provider.invokeStructured(options);
  }

  async stream(options) {
    return provider.stream(options);
  }
}
