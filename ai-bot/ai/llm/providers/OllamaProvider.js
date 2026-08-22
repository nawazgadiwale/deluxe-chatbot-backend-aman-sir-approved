import { ChatOllama } from "@langchain/ollama";
import BaseProvider from "./BaseProvider.js";

// openai model as provider use with key
// import OpenAI from "openai";

// export default class OpenAIProvider extends BaseProvider {
//   constructor() {
//     super();
//     this.models = new Map();
//   }

//   getModel(options = {}) {
//     const config = {
//       model : options.model ?? "gpt-4o-mini",

//       temprature: options.temperature ?? 0,

//       topP: options.topP ?? 0.8,

//       numPredict: options.numPredict ?? 350,

//       numCtx: options.numCtx ?? 4096,
//     };

//     const key = JSON.stringify(config);

//     if (!this.models.has(key)) {
//       this.models.set(key, new OpenAI(config));
//     }

//     return this.models.get(key);
//   }
// }

export default class OllamaProvider extends BaseProvider {
  constructor() {
    super();
    this.models = new Map();
  }

  getModel(options = {}) {
    const config = {
      model: options.model ?? "phi3:mini",

      temperature: options.temperature ?? 0,

      topP: options.topP ?? 0.8,

      numPredict: options.numPredict ?? 350,

      numCtx: options.numCtx ?? 4096,
    };

    const key = JSON.stringify(config);

    if (!this.models.has(key)) {
      this.models.set(key, new ChatOllama(config));
    }

    return this.models.get(key);
  }

  async invoke({ systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);

    const response = await model.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ]);

    return response.content;
  }

  async invokeStructured({ schema, systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);

    const structuredModel = model.withStructuredOutput(schema);

    return structuredModel.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async stream({ systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);

    return model.stream([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }
}

