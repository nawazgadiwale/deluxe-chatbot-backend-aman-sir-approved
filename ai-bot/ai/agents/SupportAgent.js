import BaseAgent from "./BaseAgent.js";
import ResponseBuilder from "../../core/responses/Apiresponse.js";
import SupportService from "../../modules/support/SupportService.js";

const responseBuilder = new ResponseBuilder();
const supportService = new SupportService();

export default class SupportAgent extends BaseAgent {
  async execute(state) {
    try {
      console.log("========== SUPPORT AGENT ==========");

      const result = await supportService.generate(state);

      console.log("SUPPORT RESULT:");
      console.dir(result, { depth: null });

      state.rag = {
        context: result.context ?? "",
        documents: result.documents ?? [],
      };

      state.response = responseBuilder.support(result.answer, {
        source: "support",
        ...(result.metadata ?? {}),
      });

      /*
       * Support can resume an interrupted workflow.
       * This behavior is intentionally kept for SUPPORT.
       */
      if (state.workflowStack?.length) {
        responseBuilder.appendResumePrompt(
          state.response,
          state.workflowStack[state.workflowStack.length - 1],
        );
      }

      return state;
    } catch (error) {
      console.error("========== SUPPORT AGENT ERROR ==========");

      console.error(error);

      state.response = responseBuilder.error(
        "Unable to process your support request right now.",
        {
          source: "support",
        },
      );

      return state;
    }
  }
}
