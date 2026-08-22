import BaseAgent from "./BaseAgent.js";

import ResponseBuilder from "../../core/responses/Apiresponse.js";
import SupportService from "../../modules/support/SupportService.js";

const responseBuilder = new ResponseBuilder();

const supportService = new SupportService();

export default class SupportAgent extends BaseAgent {
  async execute(state) {
    const result = await supportService.generate(state);

    state.rag = {
      context: result.context,
      documents: result.documents,
    };

    state.response = responseBuilder.support(result.answer);

    if (state.workflowStack?.length) {
      responseBuilder.appendResumePrompt(
        state.response,
        state.workflowStack[state.workflowStack.length - 1],
      );
    }

    return state;
  }
}
