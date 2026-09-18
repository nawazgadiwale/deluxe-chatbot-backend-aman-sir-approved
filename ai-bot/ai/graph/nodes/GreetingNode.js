import ResponseBuilder from "../../../core/responses/Apiresponse.js";

const responseBuilder = new ResponseBuilder();

export default class GreetingNode {
  async execute(state) {
    // Greeting is stateless. Never start or modify an order.
    state.workflow = null;
    state.currentStep = null;
    state.awaitingDecision = false;
    state.transientExecution = null;

    const rawName = state.customer?.name?.trim() || null;
    const isPlaceholder = (val) =>
      !val ||
      /^(test user|unknown|undefined|null|n\/a)$/i.test(String(val).trim());
    const name = !isPlaceholder(rawName) ? rawName : null;

    const totalSessions = Number.isFinite(state.totalSessions)
      ? state.totalSessions
      : 1;

    const isNewVisitor =
      state.isPureVisitor === true &&
      !state.hasOrdered &&
      !state.hasSubmittedLead &&
      !state.hasRequestedQuote &&
      !state.hasRequirement &&
      !state.leadId &&
      !state.isReturningVisitor &&
      totalSessions <= 1 &&
      !state.previousSessionId &&
      (!state.history || state.history.length === 0);

    const isReturning =
      !isNewVisitor &&
      (state.isReturningVisitor === true ||
        state.isKnownCustomer === true ||
        state.hasSubmittedLead === true ||
        state.hasRequestedQuote === true ||
        state.hasOrdered === true ||
        state.hasRequirement === true ||
        Boolean(state.conversationId) ||
        Boolean(state.leadId));

    console.log("[GreetingNode] State before greeting:", {
      "customer.name": state.customer?.name ?? null,
      isReturning,
      workflow: state.workflow,
      currentStep: state.currentStep,
      classification:
        state.routing?.classification ?? state.routing?.source ?? "GREETING",
      capability: state.capability ?? "greeting",
      selectedProduct:
        state.selectedProduct?.name ??
        state.selectedProduct?.id ??
        state.selectedProduct ??
        null,
    });

    let message;
    if (isReturning) {
      message = name
        ? `Welcome back, ${name}! 👋\n\nWhat can I help you with today?`
        : "Welcome back! 👋\n\nWhat can I help you with today?";
    } else {
      message = "Hi there! 👋\n\nWhat are you looking to print today?";
    }

    state.persistence.conversation = {
      ...state.persistence.conversation,
      dirty: true,
      updatedAt: new Date(),
    };

    const brandLogo =
      state.site === "exprintmart"
        ? "https://www.exprintmart.com/_next/static/media/exprint_logo.41b1dc5b.svg"
        : "https://www.dlxprint.com/images/dlxprint.svg";

    state.response = responseBuilder.success({
      type: "greeting",
      message,
      actions: [],
      data: { brandAsset: brandLogo },
      metadata: { brandAsset: brandLogo },
    });

    return state;
  }
}

