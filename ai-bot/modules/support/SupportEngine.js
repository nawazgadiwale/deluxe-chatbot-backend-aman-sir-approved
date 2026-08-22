import LLMService from "../../ai/llm/LLMService.js";
import RAGPipeline from "../../ai/rag//retrieval/RagPipeline.js";

import SupportPrompt from "../../ai/llm/prompts/SupportPrompt.js";

const llmService = new LLMService();
const ragPipeline = new RAGPipeline();

export default class SupportEngine {
  async generate(state) {
    const retrieval = await ragPipeline.retrieve({
      query: state.userMessage,
      conversation: state,
      options: {
        topK: 2,
      },
    });

    const schema = {
      type: "object",
      properties: {
        answer: {
          type: "string",
        },

        references: {
          type: "array",
          items: {
            type: "string",
          },
        },

        followUpQuestion: {
          type: "string",
        },
      },
      required: ["answer", "references", "followUpQuestion"],
    };

    const prompt = SupportPrompt({
      context: retrieval.context,
      history: state.history,
      customer: state.customer,
      orderRequest: state.orderRequest,
      message: state.userMessage,
    });

    const response = await llmService.invokeStructured({
      schema,
      systemPrompt: prompt,
      userMessage: state.userMessage,
    });

    console.log("RAW LLM RESPONSE");
    console.dir(response, { depth: null });

    return {
      context: retrieval.context,
      documents: retrieval.documents,
      response,
    };
  }
}
