import DiscoveryService from "../../../modules/discovery/DiscoveryService.js";

import ResponseBuilder from "../../../core/responses/Apiresponse.js";

const discoveryService = new DiscoveryService();
const responseBuilder = new ResponseBuilder();

export default class DiscoveryNode {
  async execute(state) {
    console.log("DiscoveryNode Executed");

    /*
     * =====================================================
     * Generate Discovery Results
     * =====================================================
     */

    const result = await discoveryService.generate(state);

    /*
     * =====================================================
     * Store Discovery Context
     * =====================================================
     */

    state.discovery = {
      products: result.products,
      totalProducts: result.products.length,
      generatedAt: new Date(),
    };

    /*
     * =====================================================
     * Workflow
     * =====================================================
     */

    state.workflow = null;
    state.currentStep = null;
    state.awaitingDecision = false;

    /*
     * =====================================================
     * Persistence
     * =====================================================
     */

    state.persistence.conversation = {
      ...state.persistence.conversation,
      dirty: true,
      updatedAt: new Date(),
    };

    /*
     * =====================================================
     * Response
     * =====================================================
     */

    state.response = responseBuilder.success({
      type: "discovery",

      data: {
        summary: result.summary,
        followUpQuestion: result.followUpQuestion,
        products: result.products,
      },
    });

    if (state.workflowStack?.length) {
      responseBuilder.appendResumePrompt(
        state.response,
        state.workflowStack[state.workflowStack.length - 1],
      );
    }

    return state;
  }
}
