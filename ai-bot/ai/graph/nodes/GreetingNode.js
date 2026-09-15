import ResponseBuilder from "../../../core/responses/Apiresponse.js";

const responseBuilder = new ResponseBuilder();

const BRAND_GREETING_LOGO_URL =
  "https://www.dlxprint.com/images/dlxprint.svg";

export default class GreetingNode {
  async execute(state) {
    /**
     * Greeting is stateless.
     * It must not start or modify an order.
     */
    state.workflow = null;
    state.currentStep = null;
    state.awaitingDecision = false;

    /**
     * Visitor Context
     */
    const visitorType = state.visitorType ?? "VISITOR";
    const customer = state.customer ?? {};
    const name = customer.name?.trim() || null;

    let message;

    switch (visitorType) {
      case "CUSTOMER":
        message = name
          ? `Welcome back, ${name}! 👋 How can I help you today? You can place another order, explore products, or ask questions.`
          : "Welcome back! 👋 How can I help you today? You can place another order, explore products, or ask questions.";
        break;

      case "QOUTATION":
      case "LEAD":
        message = name
          ? `Welcome back, ${name}! 👋 I can help you with your printing requirements, quotations, or product options. What would you like to explore?`
          : "Welcome back! 👋 I can help you with your printing requirements, quotations, or product options. What would you like to explore?";
        break;

      case "VISITOR":
      default:
        message =
          "Hi! 👋 Welcome to Deluxe Printing.\n\n" +
          "What would you like to order today?\n\n" +
          "Simply type the product you need, for example:\n" +
          "• Business Cards\n" +
          "• Flyers\n" +
          "• Brochures";
        break;
    }

    /**
     * Persistence
     */
    state.persistence.conversation = {
      ...state.persistence.conversation,
      dirty: true,
      updatedAt: new Date(),
    };

    /**
     * Response
     */
    state.response = responseBuilder.success({
      type: "greeting",
      message,
      actions: [],
      data: {
        brandAsset: BRAND_GREETING_LOGO_URL,
        image: BRAND_GREETING_LOGO_URL,
      },
      metadata: {
        brandAsset: BRAND_GREETING_LOGO_URL,
      },
    });

    return state;
  }
}
