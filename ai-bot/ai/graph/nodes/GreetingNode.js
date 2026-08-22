import ResponseBuilder from "../../../core/responses/Apiresponse.js";

const responseBuilder = new ResponseBuilder();

export default class GreetingNode {
  async execute(state) {
    /*
     * =====================================================
     * Greeting is Stateless
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
      type: "greeting",

      message:
        "Hello! 👋 Welcome to Deluxe Printing. I'm your AI Assistant. I can help you discover products, recommend solutions for your business or personal needs, explain product details, compare products, answer company questions, assist with orders, or connect you with our sales team. How can I assist you today?",
    });

    return state;
  }
}
