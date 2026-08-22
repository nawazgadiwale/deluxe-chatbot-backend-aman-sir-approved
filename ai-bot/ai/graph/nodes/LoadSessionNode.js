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

    /*
     * =====================================================
     * Load Conversation
     * =====================================================
     */

    let conversation = await conversationRepository.findBySessionId(
      state.sessionId,
    );

    console.log("SESSION:", state.sessionId);

    console.log("FOUND:", !!conversation);

    if (conversation) {
      console.log("Workflow:", conversation.workflow);
    }

    /*
     * =====================================================
     * Create Conversation
     * =====================================================
     */

    if (!conversation) {
      conversation = await conversationRepository.create({
        sessionId: state.sessionId,

        customer: {
          name: null,
          mobile: null,
          email: null,
          company: null,
        },

        messages: [],

        workflow: null,

        currentStep: null,

        memory: {},

        metadata: {},

        status: "ACTIVE",
      });
    }

    /*
     * =====================================================
     * Load Active Order
     * =====================================================
     */

    let order = await orderRepository.findActiveBySession(state.sessionId);

    /*
     * =====================================================
     * Restore Confirmed Order During Lead Workflow
     * =====================================================
     */

    if (!order && conversation.workflow === "LEAD") {
      console.log("No active order found. Restoring order by conversation.");

      order = await orderRepository.findByConversationId(conversation._id);
    }

    /*
     * =====================================================
     * Base Conversation
     * =====================================================
     */

    state.conversation = conversation;

    state.conversationId = conversation._id.toString();

    state.order = order ?? null;

    state.orderContext = order ?? null;

    /*
     * =====================================================
     * Lead
     * =====================================================
     *
     * IMPORTANT:
     *
     * There is no LeadRequest lookup anymore.
     *
     * A newly created lead exists as:
     *
     * state.lead
     *
     * It is created by LeadEngine when the Lead
     * workflow executes.
     *
     * Since Data does not contain sessionId/conversationId,
     * we don't try to restore it here.
     */

    state.lead = state.lead ?? null;

    /*
     * =====================================================
     * Customer
     * =====================================================
     */

    state.customer = {
      name: null,

      phone: null,

      email: null,

      company: null,

      ...(conversation.customer ?? {}),
    };

    /*
     * =====================================================
     * History
     * =====================================================
     */

    state.history = Array.isArray(conversation.messages)
      ? [...conversation.messages.slice(-50)]
      : [];

    state.workflow = null;

    state.currentStep = conversation.currentStep ?? null;

    state.awaitingDecision = false;

    state.workflowStack = conversation.metadata?.workflowStack ?? [];

    /*
     * =====================================================
     * Restore Memory
     * =====================================================
     */

    state.memory = memoryService.build(conversation);

    /*
     * =====================================================
     * Restore Runtime Sales State
     * =====================================================
     */

    state.liveRequirement = state.memory.liveRequirement ?? null;

    state.productSales = state.memory.productSales ?? null;

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

    /*
     * =====================================================
     * Restore Active Workflow
     *
     * Priority:
     *
     * SALES
     * RECOMMENDATION
     * LEAD
     * =====================================================
     */

    const activeOrder =
      order && !["CONFIRMED", "CANCELLED", "DELETED"].includes(order.status);

    const activeSalesWorkflow =
      conversation.workflow === "SALES" &&
      (state.liveRequirement != null || state.productSales != null);

    if (activeOrder || activeSalesWorkflow) {
      state.workflow = "SALES";

      state.currentStep = conversation.currentStep ?? null;

      state.awaitingDecision = true;
    } else if (
      conversation.workflow === "RECOMMENDATION" &&
      state.recommendationContext.active &&
      !state.recommendationContext.completed
    ) {
      state.workflow = "RECOMMENDATION";

      state.currentStep =
        conversation.currentStep ??
        state.recommendationContext.currentStep ??
        "ASK_CUSTOMER_TYPE";

      state.awaitingDecision = true;
    } else if (conversation.workflow === "LEAD") {
      /*
       * =================================================
       * Lead
       * =================================================
       *
       * The new Lead workflow is one-shot:
       *
       * LeadEngine
       *    ↓
       * Data
       *    ↓
       * COMPLETED
       *
       * There is no LeadRequest status to restore.
       */

      state.workflow = "LEAD";

      state.currentStep = conversation.currentStep ?? "LEAD_COMPLETED";

      state.awaitingDecision = false;
    }

    /*
     * =====================================================
     * Persistence Flags
     * =====================================================
     */

    state.persistence = {
      conversation: {
        dirty: false,

        updatedAt: null,
      },

      customer: {
        dirty: false,

        updatedAt: null,
      },

      order: {
        dirty: false,

        updatedAt: null,
      },
    };

    /*
     * =====================================================
     * Debug
     * =====================================================
     */

    console.log("RESTORED WORKFLOW", {
      workflow: state.workflow,

      currentStep: state.currentStep,

      awaitingDecision: state.awaitingDecision,

      hasRequirement: !!state.liveRequirement,

      hasProductSales: !!state.productSales,

      hasLead: !!state.lead,
    });

    return state;
  }
}
