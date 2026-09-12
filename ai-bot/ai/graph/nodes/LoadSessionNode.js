import ConversationRepository from "../../../repositories/ConversationRepository.js";
import OrderRepository from "../../../repositories/OrderRequestRepository.js";
import MemoryService from "../../../modules/memory/MemoryService.js";

const conversationRepository = new ConversationRepository();
const orderRepository = new OrderRepository();
const memoryService = new MemoryService();

export default class LoadSessionNode {
  async execute(state) {
    if (!state.sessionId) {
      throw new Error("Session ID is required.");
    }

    if (!state.visitorId) {
      throw new Error("Visitor ID is required.");
    }

    const site = state.site ?? "exprintmart";

    // 1. FIND CURRENT SESSION

    let conversation = await conversationRepository.findBySessionId(
      state.sessionId,
      site,
    );

    console.log("======================================");
    console.log("LOAD SESSION");
    console.log("Session :", state.sessionId);
    console.log("Visitor :", state.visitorId);
    console.log("Site    :", site);
    console.log("Found   :", !!conversation);
    console.log("======================================");

    // 2. EXISTING SESSION

    if (conversation) {
      console.log("Existing conversation found:", conversation._id.toString());

      console.log("Workflow:", conversation.workflow);

      /*
       * IMPORTANT:
       *
       * This is the current session.
       *
       * NEVER replace state.sessionId with another
       * session's sessionId.
       */

      state.conversation = conversation;

      state.conversationId = conversation._id.toString();

      /*
       * Trust the stored visitorId for an existing
       * conversation.
       */

      state.visitorId =
        conversation.visitorId || state.visitorId || state.sessionId;

      state.ipAddress = state.ipAddress ?? conversation.ipAddress ?? null;
    }

    // 3. NEW SESSION

    if (!conversation) {
      /*
       * The visitor already has an identity, but this
       * sessionId does not exist.
       *
       * Therefore:
       *
       * SAME visitorId
       * NEW sessionId
       */

      const visitorSummary = await conversationRepository.getVisitorSummary(
        state.visitorId,
        site,
      );

      console.log("VISITOR SUMMARY:", visitorSummary);

      const previousSession =
        await conversationRepository.findLatestPreviousSession(
          state.visitorId,
          state.sessionId,
          site,
        );

      // ===================================================
      // CREATE NEW SESSION
      // ===================================================

      conversation = await conversationRepository.createConversation({
        sessionId: state.sessionId,

        /*
         * SAME visitor
         */

        visitorId: state.visitorId,

        site,

        ipAddress: state.ipAddress ?? previousSession?.ipAddress ?? null,

        /*
         * Restore known customer details at the
         * visitor level into the new session.
         *
         * This does NOT merge the old messages.
         */

        customer: visitorSummary.customer,

        visitorType: visitorSummary.isKnownCustomer
          ? "CUSTOMER"
          : visitorSummary.isQuotationCustomer
            ? "QOUTATION"
            : visitorSummary.isLead
              ? "LEAD"
              : "VISITOR",

        previousSessionId: previousSession?.sessionId ?? null,

        totalSessions: visitorSummary.sessionCount + 1,

        visitorContext: {
          isReturningVisitor: visitorSummary.isReturningVisitor,

          sessionCount: visitorSummary.sessionCount + 1,

          hasSearched: visitorSummary.hasSearched,

          hasViewedProduct: visitorSummary.hasViewedProduct,

          hasStartedOrder: visitorSummary.hasStartedOrder,

          hasSubmittedLead: visitorSummary.hasSubmittedLead,

          hasOrdered: visitorSummary.hasOrdered,

          hasRequestedQuote: visitorSummary.hasRequestedQuote,

          isPureVisitor: visitorSummary.isPureVisitor,
        },
      });

      console.log("======================================");
      console.log("NEW SESSION CREATED");

      console.log({
        newSessionId: conversation.sessionId,
        visitorId: conversation.visitorId,
        previousSessionId: conversation.previousSessionId,
        isReturningVisitor: visitorSummary.isReturningVisitor,
        isPureVisitor: visitorSummary.isPureVisitor,
        isLead: visitorSummary.isLead,
        isQuotationCustomer: visitorSummary.isQuotationCustomer,
        isKnownCustomer: visitorSummary.isKnownCustomer,
      });

      console.log("======================================");

      // ===================================================
      // IMPORTANT STATE IDENTITY
      // ===================================================

      state.conversation = conversation;

      state.conversationId = conversation._id.toString();

      /*
       * KEEP THE CURRENT SESSION ID.
       *
       * Do NOT use:
       *
       * previousSession.sessionId
       *
       * here.
       */

      state.sessionId = conversation.sessionId;

      /*
       * visitorId remains the same.
       */

      state.visitorId = conversation.visitorId;

      state.ipAddress = conversation.ipAddress;

      // ===================================================
      // VISITOR-LEVEL FLAGS
      // ===================================================

      state.visitorContext = {
        ...(conversation.visitorContext ?? {}),
      };

      state.isReturningVisitor = visitorSummary.isReturningVisitor;
      state.isPureVisitor = visitorSummary.isPureVisitor;
      state.isKnownCustomer = visitorSummary.isKnownCustomer;
      state.isLead = visitorSummary.isLead;
      state.isQuotationCustomer = visitorSummary.isQuotationCustomer;
    }

    // ===================================================
    // VISITOR-LEVEL STATE
    // ===================================================

    if (conversation) {
      const visitorSummary = await conversationRepository.getVisitorSummary(
        state.visitorId,
        site,
      );

      state.visitorContext = {
        ...(conversation.visitorContext ?? {}),
      };

      state.isReturningVisitor = visitorSummary.isReturningVisitor;

      state.isPureVisitor = visitorSummary.isPureVisitor;

      state.isKnownCustomer = visitorSummary.isKnownCustomer;

      state.isLead = visitorSummary.isLead;

      state.isQuotationCustomer = visitorSummary.isQuotationCustomer;

      state.visitorType = visitorSummary.isKnownCustomer
        ? "CUSTOMER"
        : visitorSummary.isQuotationCustomer
          ? "QOUTATION"
          : visitorSummary.isLead
            ? "LEAD"
            : "VISITOR";

      state.previousSessionId = conversation.previousSessionId ?? null;

      state.totalSessions =
        conversation.totalSessions ?? visitorSummary.sessionCount;
    }

    // 4. CURRENT SESSION ORDER

    let order = await orderRepository.findActiveBySession(state.sessionId);

    // 5. RESTORE ORDER DURING LEAD

    if (!order && conversation.workflow === "LEAD") {
      console.log("No active order found. Restoring order by conversation.");

      order = await orderRepository.findByConversationId(conversation._id);
    }

    // 6. BASE CONVERSATION

    state.conversation = conversation;

    state.conversationId = conversation._id.toString();

    state.ipAddress = state.ipAddress ?? conversation.ipAddress ?? null;

    state.order = order ?? null;

    state.orderContext = order ?? null;

    // 7. CUSTOMER

    const orderCust = order?.customer
      ? (typeof order.customer.toObject === "function"
          ? order.customer.toObject()
          : order.customer)
      : {};

    const convCust = conversation.customer
      ? (typeof conversation.customer.toObject === "function"
          ? conversation.customer.toObject()
          : conversation.customer)
      : {};

    state.customer = {
      name: null,
      phone: null,
      email: null,
      company: null,
      ...(convCust ?? {}),
      ...Object.fromEntries(
        Object.entries(orderCust).filter(([_, v]) => v != null && v !== ""),
      ),
    };

    // 8. HISTORY

    state.history = Array.isArray(conversation.messages)
      ? [...conversation.messages.slice(-50)]
      : [];

    // 9. CURRENT WORKFLOW

    state.currentStep = conversation.currentStep ?? null;

    state.awaitingDecision = false;

    state.workflowStack = conversation.metadata?.workflowStack ?? [];

    state.metadata = {
      ...(conversation.metadata ?? {}),
      ...(state.metadata ?? {}),
    };

    if (state.currentStep && state.metadata?.routing) {
      state.metadata.routing.step = state.currentStep;
    }

    // 10. RESTORE MEMORY

    state.memory = memoryService.build(conversation);

    // 11. RESTORE SALES STATE

    state.liveRequirement = state.memory.liveRequirement ?? (order ?? null);

    if (state.liveRequirement) {
      state.liveRequirement.customer = {
        ...(state.liveRequirement.customer ?? {}),
        ...state.customer,
      };
      if (
        Array.isArray(state.liveRequirement.items) &&
        state.liveRequirement.items.length > 0
      ) {
        state.liveRequirement.items[0].customer = {
          ...(state.liveRequirement.items[0].customer ?? {}),
          ...state.customer,
        };
      }
    }

    state.productSales = state.memory.productSales ?? state.liveRequirement ?? null;

    state.recommendation = state.memory.recommendation ?? null;

    state.recommendationContext =
      state.memory.recommendationContext ??
      memoryService.createRecommendationContext();

    state.recommendationSolution = state.recommendationContext.solution ?? {
      primary: [],
      supporting: [],
      upsell: [],
    };

    state.selectedProduct = state.memory.selectedProduct ?? null;

    state.comparison = state.memory.comparison ?? null;

    state.comparisonContext = state.memory.comparisonContext ?? null;

    state.comparisonProducts = state.memory.comparisonProducts ?? [];

    // 12. RESTORE ACTIVE WORKFLOW

    const activeOrder =
      order && !["CONFIRMED", "CANCELLED", "DELETED"].includes(order.status);

    const activeSalesWorkflow =
      conversation.workflow === "SALES" &&
      (state.liveRequirement != null || state.productSales != null);

    if (activeOrder || activeSalesWorkflow) {
      state.workflow = "SALES";

      state.currentStep =
        conversation.currentStep ??
        (order?.status === "REVIEW"
          ? "ORDER_REVIEW"
          : (activeOrder ? "ORDER_FORM" : null));

      state.awaitingDecision = true;
    }

    // RECOMMENDATION
    else if (
      conversation.workflow === "RECOMMENDATION" &&
      state.recommendationContext?.active &&
      !state.recommendationContext?.completed
    ) {
      state.workflow = "RECOMMENDATION";

      state.currentStep =
        conversation.currentStep ??
        state.recommendationContext.currentStep ??
        "ASK_CUSTOMER_TYPE";

      state.awaitingDecision = true;
    }

    // LEAD
    else if (conversation.workflow === "LEAD") {
      state.workflow = "LEAD";

      state.currentStep = conversation.currentStep ?? "LEAD_COMPLETED";

      state.awaitingDecision = false;
    }

    // NONE / OTHER
    else {
      state.workflow = conversation.workflow ?? "NONE";
      state.currentStep = null;
      state.selectedProduct = null;
      state.liveRequirement = null;
      state.productSales = null;
      state.awaitingDecision = false;
    }

    // LEAD

    state.lead = state.lead ?? null;

    // PERSISTENCE FLAGS

    state.persistence = {
      conversation: {
        dirty: false,
        updatedAt: null,
      },

      customer: {
        dirty: false,
        updatedAt: null,
      },

      leadRequest: {
        dirty: false,
        updatedAt: null,
      },

      order: {
        dirty: false,
        updatedAt: null,
      },
    };

    // DEBUG

    console.log("======================================");
    console.log("RESTORED SESSION");

    console.log({
      sessionId: state.sessionId,
      conversationId: state.conversationId,
      visitorId: state.visitorId,
      workflow: state.workflow,
      currentStep: state.currentStep,
      awaitingDecision: state.awaitingDecision,
      visitorType: state.visitorType,
      previousSessionId: state.previousSessionId,
      totalSessions: state.totalSessions,
      isReturningVisitor: state.isReturningVisitor,
      isPureVisitor: state.isPureVisitor,
      isLead: state.isLead,
      isQuotationCustomer: state.isQuotationCustomer,
      isKnownCustomer: state.isKnownCustomer,
      hasRequirement: !!state.liveRequirement,
      hasProductSales: !!state.productSales,
      hasLead: !!state.lead,
    });

    console.log("======================================");

    return state;
  }
}
