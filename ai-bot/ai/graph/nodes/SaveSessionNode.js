import ConversationRepository from "../../../repositories/ConversationRepository.js";

import MemoryService from "../../../modules/memory/MemoryService.js";

import OrderRepository from "../../../repositories/OrderRequestRepository.js";

const conversationRepository = new ConversationRepository();

const orderRepository = new OrderRepository();

const memoryService = new MemoryService();

export default class SaveSessionNode {
  async execute(state) {
    console.log("SAVE NODE currentStep:", state.currentStep);

    /*
     * =====================================================
     * SYNCHRONIZE CUSTOMER
     * =====================================================
     */

    if (state.lead) {
      state.customer = {
        ...(state.customer ?? {}),

        name: state.lead.name ?? state.customer?.name ?? null,

        phone: state.lead.phoneNumber ?? state.customer?.phone ?? null,

        email: state.lead.emailId ?? state.customer?.email ?? null,

        company: state.lead.companyName ?? state.customer?.company ?? null,
      };
    }

    /*
     * =====================================================
     * BUILD LATEST MEMORY SNAPSHOT
     * =====================================================
     */

    state.memory = memoryService.merge(state.memory, state);

    state.recommendation = state.memory.recommendation;

    state.recommendationContext = state.memory.recommendationContext;

    /*
     * =====================================================
     * CLEAN + DEDUPLICATE CONVERSATION HISTORY
     * =====================================================
     *
     * IMPORTANT:
     *
     * The same user message can currently be appended
     * multiple times before reaching this node.
     *
     * We therefore deduplicate messages before persistence.
     *
     * Primary identity:
     *
     *     messageId
     *
     * Fallback identity:
     *
     *     role + content + timestamp
     *
     * This preserves legitimate repeated messages when
     * they occur at different timestamps.
     */

    const history = Array.isArray(state.history) ? state.history : [];

    const seenMessageIds = new Set();

    const seenFallbackKeys = new Set();

    const cleanedHistory = [];

    for (const message of history) {
      /*
       * ---------------------------------------------
       * BASIC VALIDATION
       * ---------------------------------------------
       */

      if (!message || !message.role || typeof message.content !== "string") {
        continue;
      }

      const content = message.content.trim();

      if (!content) {
        continue;
      }

      /*
       * ---------------------------------------------
       * MESSAGE ID
       * ---------------------------------------------
       */

      if (message.messageId) {
        if (seenMessageIds.has(message.messageId)) {
          continue;
        }

        seenMessageIds.add(message.messageId);

        cleanedHistory.push({
          ...message,
          content,
        });

        continue;
      }

      /*
       * ---------------------------------------------
       * FALLBACK DEDUPLICATION
       * ---------------------------------------------
       *
       * This handles your CURRENT messages because
       * they don't have messageId yet.
       */

      const timestamp = message.timestamp
        ? new Date(message.timestamp).getTime()
        : "";

      const fallbackKey = `${message.role}|${content}|${timestamp}`;

      if (seenFallbackKeys.has(fallbackKey)) {
        continue;
      }

      seenFallbackKeys.add(fallbackKey);

      cleanedHistory.push({
        ...message,
        content,
      });
    }

    /*
     * Keep latest 50 messages.
     */

    state.history = cleanedHistory.slice(-50);

    console.log("========== HISTORY ==========");

    console.log("Original:", history.length);

    console.log("After cleanup:", state.history.length);

    /*
     * =====================================================
     * PERSIST CONVERSATION
     * =====================================================
     */

    const active =
      state.order &&
      !["CONFIRMED", "CANCELLED", "DELETED"].includes(state.order.status);

    const workflow = active ? "SALES" : (state.workflow ?? null);

    /*
     * Order workflow is form-based.
     */

    const currentStep = state.order?.active
      ? null
      : (state.currentStep ?? null);

    const conversationUpdate = {
      customer: state.customer,

      /*
       * requestType belongs to Conversation.
       */

      requestType:
        state.conversation?.requestType ??
        state.leadContext?.requestType ??
        state.requestType ??
        null,

      workflow,

      currentStep,

      metadata: {
        ...(state.metadata ?? {}),

        workflowStack: state.workflowStack ?? [],

        lastRecommendationAt: state.recommendationContext?.completedAt ?? null,
      },

      memory: {
        ...(state.memory ?? {}),

        recommendation: state.recommendation,

        recommendationContext: state.recommendationContext,
      },

      messages: state.history,

      status: state.status ?? "ACTIVE",

      updatedAt: new Date(),
    };

    console.log("========== CONVERSATION UPDATE ==========");

    console.log({
      sessionId: state.sessionId,

      workflow,

      currentStep,

      requestType: conversationUpdate.requestType,

      historyLength: state.history.length,
    });

    state.conversation = await conversationRepository.update(
      {
        sessionId: state.sessionId,
      },
      {
        $set: conversationUpdate,
      },
      {
        upsert: true,
      },
    );

    /*
     * =====================================================
     * RELOAD CONVERSATION SNAPSHOT
     * =====================================================
     */

    state.conversation = await conversationRepository.findBySessionId(
      state.sessionId,
    );

    /*
     * =====================================================
     * SYNCHRONIZE MEMORY SNAPSHOT
     * =====================================================
     */

    state.memory = memoryService.build(state.conversation);

    if (state.persistence?.conversation) {
      state.persistence.conversation.dirty = false;
    }

    /*
     * =====================================================
     * LINK ORDER -> LEAD
     * =====================================================
     */

    const pendingLeadId =
      state.order && state.lead?._id && state.order.leadId !== state.lead._id
        ? state.lead._id
        : null;

    /*
     * =====================================================
     * PERSIST ORDER
     * =====================================================
     */

    if (state.persistence?.order?.dirty && state.order) {
      state.order.updatedAt = new Date();

      state.order = await orderRepository.saveDraft(
        state.sessionId,
        state.conversationId,
        state.order,
      );

      /*
       * ---------------------------------------------
       * LINK ORDER -> LEAD
       * ---------------------------------------------
       */

      if (pendingLeadId) {
        state.order = await orderRepository.update(state.order._id, {
          leadId: pendingLeadId,
        });
      }

      state.orderContext = state.order;

      state.persistence.order.dirty = false;
    }

    return state;
  }
}
