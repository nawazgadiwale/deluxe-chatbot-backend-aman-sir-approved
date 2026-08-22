const ConversationRepository = require("../ai-bot/repositories/ConversationRepository");

const ConversationMapperModule = require("../ai-bot/modules/conversation/ConversationMapper");

const createConversationGraphModule = require("../ai-bot/ai/graph/ConversationGraph");

const ConversationMapper =
  ConversationMapperModule.default || ConversationMapperModule;

const createConversationGraph =
  createConversationGraphModule.default || createConversationGraphModule;
class AIService {
  constructor() {
    this.conversationRepository = new ConversationRepository();

    this.conversationMapper = new ConversationMapper();

    this.graph = null;
  }

  // =====================================================
  // GRAPH
  // =====================================================

  getGraph() {
    if (!this.graph) {
      this.graph = createConversationGraph();
    }

    return this.graph;
  }

  // =====================================================
  // CHAT
  // =====================================================

  async chat({
    sessionId,
    site = "exprintmart",
    message = "",
    visitor = {},
    action = null,
    attachments = [],
  }) {
    this.validateRequest({
      sessionId,
      site,
      message,
      action,
    });

    // ---------------------------------------------------
    // LOAD / CREATE CONVERSATION
    // ---------------------------------------------------

    const conversation = await this.loadConversation({
      sessionId,
      visitor,
    });

    // ---------------------------------------------------
    // MONGO → GRAPH STATE
    // ---------------------------------------------------

    const baseState = this.conversationMapper.toState(conversation);

    const graphState = {
      ...baseState,

      sessionId,

      site,

      userMessage: message ? message.trim() : "",

      action: action || null,

      attachments: Array.isArray(attachments) ? attachments : [],

      visitor: {
        ...(baseState.visitor || {}),
        ...(visitor || {}),
      },

      // Runtime input only
      history: message
        ? [
            {
              role: "user",
              content: message.trim(),
              timestamp: new Date(),
            },
          ]
        : [],
    };

    // ---------------------------------------------------
    // LOG
    // ---------------------------------------------------

    console.log("\n========== AI GRAPH ==========");

    console.log({
      sessionId: graphState.sessionId,
      site: graphState.site,
      workflow: graphState.workflow,
      currentStep: graphState.currentStep,
      selectedProduct: graphState.selectedProduct,
      action: graphState.action,
    });

    // ---------------------------------------------------
    // GRAPH
    // ---------------------------------------------------

    const graph = this.getGraph();

    const result = await graph.invoke(graphState);

    // ---------------------------------------------------
    // RESULT
    // ---------------------------------------------------

    console.log("========== GRAPH COMPLETED ==========");

    console.log({
      sessionId: result?.sessionId,
      workflow: result?.workflow,
      currentStep: result?.currentStep,
      selectedProduct: result?.selectedProduct,
      hasResponse: !!result?.response,
      responseType: result?.response?.type,
    });

    // ---------------------------------------------------
    // RETURN
    // ---------------------------------------------------

    return this.buildResponse(result);
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  validateRequest({ sessionId, site, message, action }) {
    const validSites = new Set(["exprintmart", "dlxprint"]);

    if (!sessionId || !sessionId.trim()) {
      throw new Error("sessionId is required");
    }

    if (!validSites.has(site)) {
      throw new Error(
        "Invalid site. Supported sites are exprintmart and dlxprint.",
      );
    }

    if ((!message || !message.trim()) && !action) {
      throw new Error("message or action is required");
    }
  }

  // =====================================================
  // LOAD / CREATE
  // =====================================================

  async loadConversation({ sessionId, visitor = {} }) {
    let conversation =
      await this.conversationRepository.findBySessionId(sessionId);

    if (!conversation) {
      conversation = await this.conversationRepository.createConversation({
        sessionId,

        customer: {
          name: visitor?.name ?? null,
          phone: visitor?.phone ?? visitor?.phoneNumber ?? null,
          email: visitor?.email ?? visitor?.emailId ?? null,
          company: visitor?.company ?? visitor?.companyName ?? null,
        },
      });
    }

    return conversation;
  }

  // =====================================================
  // GET CONVERSATION
  // =====================================================

  async getConversation({ sessionId }) {
    return this.conversationRepository.findBySessionId(sessionId);
  }

  // =====================================================
  // COMPLETE CONVERSATION
  // =====================================================

  async completeConversation({ sessionId }) {
    return this.conversationRepository.closeConversation(sessionId);
  }

  // =====================================================
  // RESPONSE
  // =====================================================

  buildResponse(state) {
    return {
      success: true,

      sessionId: state?.sessionId ?? null,

      conversationId: state?.conversationId ?? null,

      site: state?.site ?? "exprintmart",

      workflow: state?.workflow ?? null,

      currentStep: state?.currentStep ?? null,

      awaitingDecision: state?.awaitingDecision ?? false,

      capability: state?.capability ?? null,

      selectedProduct: state?.selectedProduct ?? null,

      response: state?.response ?? null,

      lead: state?.lead ?? null,

      order: state?.order ?? null,

      customer: state?.customer ?? null,

      liveRequirement: state?.liveRequirement ?? null,
    };
  }
}

module.exports = AIService;
