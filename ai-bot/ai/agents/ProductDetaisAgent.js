import BaseAgent from "./BaseAgent.js";
import ProductDetailsService from "../../modules/productdetails/ProductDetailsService.js";
import ResponseBuilder from "../../core/responses/Apiresponse.js";

const service = new ProductDetailsService();
const responseBuilder = new ResponseBuilder();

export default class ProductDetailsAgent extends BaseAgent {
  async execute(state) {
    const details = await service.generate(state);

    /*
     * Product not found
     */
    if (!details) {
      state.response = responseBuilder.productDetails({
        summary: "Sorry, I couldn't find that product.",
        context: null,
        actions: [],
      });

      return state;
    }

    /*
     * Build standard API response
     */
    state.response = responseBuilder.productDetails(details);

    /*
     * If another workflow was paused,
     * add the resume/cancel actions.
     */
    if (state.workflowStack?.length) {
      responseBuilder.appendResumePrompt(
        state.response,
        state.workflowStack[state.workflowStack.length - 1],
      );
    }

    return state;
  }
}
