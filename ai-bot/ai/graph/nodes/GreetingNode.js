import ResponseBuilder from "../../../core/responses/Apiresponse.js";
import SalesCatalogService from "../../../modules/sales/services/SalesCatalogService.js";

const responseBuilder = new ResponseBuilder();
const catalogService = new SalesCatalogService();

const BRAND_GREETING_LOGO_URL =
  "https://www.exprintmart.com/_next/static/media/exprint_logo.41b1dc5b.svg";

export default class GreetingNode {
  async execute(state) {
    /**
     * Greeting is Stateless
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
          "Hi! 👋 Welcome to Deluxe Printing.\n\nWhat would you like to order today? Choose from our popular catalog products below or tell me what you need:";
        break;
    }

    /**
     * Real catalog products
     */
    const products = catalogService.getProducts();
    const actions = products.slice(0, 10).map((prod) => ({
      id: "SELECT_PRODUCT",
      label: String(prod.name ?? prod.title ?? prod.slug).slice(0, 24),
      payload: { productId: prod.id ?? prod.slug },
    }));

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
      actions,
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
