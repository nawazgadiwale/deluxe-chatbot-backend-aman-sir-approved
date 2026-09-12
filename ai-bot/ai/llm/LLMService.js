import GroqProvider from "./providers/GroqProvider.js";
import GeminiProvider from "./providers/GeminiProvider.js";

let provider;

switch ((process.env.LLM_PROVIDER || "gemini").toLowerCase()) {
  case "gemini":
    provider = new GeminiProvider();
    break;

  case "groq":
    provider = new GroqProvider();
    break;

  default:
    throw new Error(`Unsupported LLM provider: ${process.env.LLM_PROVIDER}`);
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
