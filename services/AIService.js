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
    this.sessionQueues = new Map();
  }

  // =====================================================
  // SESSION CONCURRENCY QUEUE
  // =====================================================

  enqueueSessionTask(sessionId, fn) {
    if (!sessionId || typeof fn !== "function") {
      return typeof fn === "function" ? fn() : Promise.resolve();
    }
    const previousPromise = this.sessionQueues.get(sessionId) || Promise.resolve();
    const nextPromise = previousPromise
      .catch((err) => {
        console.error(`[AIService] Prior queued session task failed for ${sessionId}:`, err?.message);
      })
      .then(() => fn())
      .finally(() => {
        if (this.sessionQueues.get(sessionId) === nextPromise) {
          this.sessionQueues.delete(sessionId);
        }
      });

    this.sessionQueues.set(sessionId, nextPromise);
    return nextPromise;
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

  async chat(params = {}) {
    const sessionId = params?.sessionId;
    return this.enqueueSessionTask(sessionId, () => this._executeChat(params));
  }

  async _executeChat({
    sessionId,
    visitorId = null,
    site = "exprintmart",
    message = "",
    visitor = {},
    action = null,
    attachments = [],

    // IMPORTANT
    channel = "WEB",

    // WhatsApp-specific context
    whatsapp = null,
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
      channel,
      whatsapp,
    });

    // ---------------------------------------------------
    // MONGO → GRAPH STATE
    // ---------------------------------------------------

    const baseState = this.conversationMapper.toState(conversation);

    const graphState = {
      ...baseState,

      sessionId,
      visitorId:
        visitorId ||
        baseState.visitorId ||
        visitor?.visitorId ||
        sessionId,
      site,

      // Explicit channel
      channel,

      userMessage: message ? message.trim() : "",

      action: action || null,

      attachments: Array.isArray(attachments) ? attachments : [],

      visitor: {
        ...(baseState.visitor || {}),
        ...(visitor || {}),
      },

      // Only present for WhatsApp requests
      whatsapp: whatsapp
        ? {
            ...(baseState.whatsapp || {}),
            ...whatsapp,
          }
        : baseState.whatsapp || null,

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
      channel: graphState.channel,
      workflow: graphState.workflow,
      currentStep: graphState.currentStep,
      selectedProduct: graphState.selectedProduct,
      action: graphState.action,

      whatsapp: graphState.whatsapp
        ? {
            phoneNumber: graphState.whatsapp.phoneNumber,
            phoneNumberId: graphState.whatsapp.phoneNumberId,
          }
        : null,
    });

    // ---------------------------------------------------
    // GRAPH
    // ---------------------------------------------------

    console.log(`[WhatsApp][Graph] START sessionId=${graphState.sessionId}`);
    const graph = this.getGraph();

    const result = await graph.invoke(graphState);
    console.log(`[WhatsApp][Graph] END sessionId=${graphState.sessionId}`);

    // ---------------------------------------------------
    // RESULT
    // ---------------------------------------------------

    console.log("========== GRAPH COMPLETED ==========");

    console.log({
      sessionId: result?.sessionId,
      channel: result?.channel,
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

  async loadConversation({
    sessionId,
    visitor = {},
    channel = "WEB",
    whatsapp = null,
  }) {
    let conversation =
      await this.conversationRepository.findBySessionId(sessionId);

    if (!conversation) {
      conversation = await this.conversationRepository.createConversation({
        sessionId,
        visitorId: visitor?.visitorId || sessionId,
        channel,
        customerWaId: whatsapp?.phoneNumber ?? null,
        metadata: whatsapp?.phoneNumberId
          ? { phoneNumberId: whatsapp.phoneNumberId }
          : {},

        customer: {
          name: visitor?.name ?? null,

          phone:
            visitor?.phone ??
            visitor?.phoneNumber ??
            whatsapp?.phoneNumber ??
            null,

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

  async getConversation({ sessionId, site = "exprintmart" }) {
    return this.conversationRepository.findBySessionId(sessionId, site);
  }

  // =====================================================
  // COMPLETE CONVERSATION
  // =====================================================

  async completeConversation({ sessionId, site = "exprintmart" }) {
    return this.conversationRepository.closeConversation(sessionId, site);
  }

  // =====================================================
  // RESPONSE
  // =====================================================

  buildResponse(state) {
    const item =
      state?.liveRequirement?.items?.[state?.liveRequirement?.currentItem ?? 0] ??
      state?.order?.items?.[state?.order?.currentItem ?? 0] ??
      null;

    const selectedProduct =
      state?.selectedProduct ??
      item?.selectedProduct ??
      item?.selection ??
      item?.product ??
      null;

    return {
      success: true,

      sessionId: state?.sessionId ?? null,

      conversationId: state?.conversationId ?? null,

      site: state?.site ?? "exprintmart",

      channel: state?.channel ?? "WEB",

      workflow: state?.workflow ?? null,

      currentStep: state?.currentStep ?? null,

      awaitingDecision: state?.awaitingDecision ?? false,

      capability: state?.capability ?? null,

      selectedProduct,

      response: state?.response ?? null,

      lead: state?.lead ?? null,

      order: state?.order ?? null,

      customer: state?.customer ?? null,

      liveRequirement: state?.liveRequirement ?? null,
    };
  }
}

module.exports = AIService;
