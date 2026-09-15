import ConversationRepository from "../../../repositories/ConversationRepository.js";
import OrderRepository from "../../../repositories/OrderRequestRepository.js";
import MemoryService from "../../../modules/memory/MemoryService.js";
import mongoose from "mongoose";

const conversationRepository = new ConversationRepository();
const orderRepository = new OrderRepository();
const memoryService = new MemoryService();

const CANCELLATION_REGEX =
  /^(cancel|cancel order|cancelled|canceling|i want to cancel|please cancel|cancel please|stop|restart|start over|start again|reset|quit|exit|nevermind|i don't want this anymore|i dont want this anymore)$/i;

export default class SaveSessionNode {
  async execute(state) {
    console.log("SAVE NODE currentStep:", state.currentStep);

    /*
     * =====================================================
     * VALIDATION
     * =====================================================
     */

    if (!state.sessionId) {
      throw new Error("Session ID is required.");
    }

    if (!state.visitorId) {
      state.visitorId = state.sessionId;
    }

    /*
     * =====================================================
     * RESTORE PERSISTENT STATE IF TRANSIENT EXECUTION
     * =====================================================
     */

    const isCancellation =
      state.action?.id === "CANCEL_ORDER" ||
      state.routing?.action?.id === "CANCEL_ORDER" ||
      CANCELLATION_REGEX.test(
        String(state.userMessage ?? state.action?.payload?.text ?? "").trim(),
      );

    if (isCancellation) {
      console.log(
        "[SaveSessionNode] Cancellation detected. Skipping transient state restoration.",
      );

      state.transientExecution = null;
      state.customerCollection = {
        started: false,
        nameResolved: false,
        emailResolved: false,
        companyResolved: false,
      };
    } else if (state.transientExecution?.active) {
      state.workflow =
        state.transientExecution.persistentWorkflow;

      state.currentStep =
        state.transientExecution.persistentStep;

      state.order =
        state.transientExecution.persistentOrder;

      state.selectedProduct =
        state.transientExecution.persistentSelectedProduct;

      state.liveRequirement =
        state.transientExecution.persistentLiveRequirement;

      state.productSales =
        state.transientExecution.persistentProductSales;

      state.awaitingDecision =
        state.transientExecution.persistentAwaitingDecision;
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
     * CLEAN + DEDUPLICATE CURRENT SESSION HISTORY
     * =====================================================
     */

    const history = Array.isArray(state.history) ? state.history : [];

    const seenMessageIds = new Set();
    const seenFallbackKeys = new Set();
    const cleanedHistory = [];

    for (const message of history) {
      if (!message || !message.role || typeof message.content !== "string") {
        continue;
      }

      const content = message.content.trim();

      if (!content) {
        continue;
      }

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

    state.history = cleanedHistory.slice(-50);

    /*
  * =====================================================
  * DETERMINE CURRENT SESSION WORKFLOW
  * =====================================================
  *
  * state.workflow is authoritative.
  *
  * An active order does NOT mean the conversation
  * is still in SALES.
  *
  * After order confirmation:
  *
  *   order  = existing order
  *   workflow = LEAD
  *   currentStep = COLLECT_NAME
  *
  * The order remains attached to the session while
  * LeadAgent owns the conversation.
  */

    const workflow =
      state.workflow ??
      state.conversation?.workflow ??
      "NONE";

    /*
     * =====================================================
     * CURRENT STEP PERSISTENCE
     * =====================================================
     */

    const currentStep =
      state.currentStep ?? null;

    console.log("========== PERSISTING STATE ==========");
    console.log("Workflow:", workflow);
    console.log("Current Step:", currentStep);
    console.log("Active Form:", currentStep === "ORDER_FORM");
    console.log(
      "Order:",
      state.order?._id
        ? String(state.order._id)
        : (state.order ? "draft" : null),
    );
    console.log(
      "Selected Product:",
      state.selectedProduct?.name ??
      state.selectedProduct?.title ??
      null,
    );
    console.log(
      "Customer Collection:",
      state.customerCollection ?? null,
    );

    /*
     * =====================================================
     * CURRENT SESSION ENGAGEMENT
     * =====================================================
     */

    const previousEngagement = state.conversation?.engagement ?? {};

    const currentEngagement = state.engagement ?? {};

    const hasSubmittedLead =
      currentEngagement.hasSubmittedLead === true ||
      previousEngagement.hasSubmittedLead === true ||
      !!state.lead;

    const hasOrdered =
      currentEngagement.hasOrdered === true ||
      previousEngagement.hasOrdered === true ||
      state.order?.status === "CONFIRMED" ||
      state.order?.confirmed === true;

    const hasRequestedQuote =
      currentEngagement.hasRequestedQuote === true ||
      previousEngagement.hasRequestedQuote === true ||
      state.requestType === "QUOTATION" ||
      state.leadContext?.requestType === "QUOTATION" ||
      state.conversation?.requestType === "QUOTATION";

    const engagement = {
      ...previousEngagement,
      ...currentEngagement,

      hasSearched:
        currentEngagement.hasSearched === true ||
        previousEngagement.hasSearched === true,

      hasViewedProduct:
        currentEngagement.hasViewedProduct === true ||
        previousEngagement.hasViewedProduct === true,

      hasStartedOrder:
        currentEngagement.hasStartedOrder === true ||
        previousEngagement.hasStartedOrder === true ||
        !!state.order,

      hasSubmittedLead,

      hasOrdered,

      hasRequestedQuote,

      abandoned:
        currentEngagement.abandoned === true ||
        previousEngagement.abandoned === true,

      lastActivityAt: new Date(),
    };

    /*
     * =====================================================
     * VISITOR CLASSIFICATION
     * =====================================================
     */

    const requestType =
      state.requestType ??
      state.leadContext?.requestType ??
      state.conversation?.requestType ??
      null;

    const visitorType = hasOrdered
      ? "CUSTOMER"
      : hasRequestedQuote || requestType === "QUOTATION"
        ? "QOUTATION"
        : hasSubmittedLead
          ? "LEAD"
          : (state.visitorType ?? state.conversation?.visitorType ?? "VISITOR");

    const isReturningVisitor =
      (state.totalSessions ?? state.conversation?.totalSessions ?? 1) > 1 ||
      !!state.previousSessionId ||
      !!state.conversation?.previousSessionId;

    const isKnownCustomer = visitorType === "CUSTOMER" || hasOrdered;

    const isQuotationCustomer =
      visitorType === "QOUTATION" ||
      requestType === "QUOTATION" ||
      hasRequestedQuote;

    const isLead = visitorType === "LEAD" || hasSubmittedLead;

    const isPureVisitor = !isKnownCustomer && !isQuotationCustomer && !isLead;

    /*
     * =====================================================
     * PERSIST CURRENT SESSION
     * =====================================================
     */

    const convCustomer =
      typeof state.conversation?.customer?.toObject === "function"
        ? state.conversation.customer.toObject()
        : (state.conversation?.customer ?? {});

    const stateCustomer =
      typeof state.customer?.toObject === "function"
        ? state.customer.toObject()
        : (state.customer ?? {});

    const customerUpdate = {
      ...convCustomer,
      ...Object.fromEntries(
        Object.entries(stateCustomer).filter(([_, v]) => v != null && v !== ""),
      ),
    };

    const conversationUpdate = {
      visitorId: state.visitorId,

      site: state.site ?? "exprintmart",

      ipAddress: state.ipAddress ?? state.conversation?.ipAddress ?? null,

      customer: customerUpdate,

      requestType,

      workflow,

      currentStep,

      memory: {
        ...(state.memory ?? {}),
        recommendation: state.recommendation ?? null,
        recommendationContext: state.recommendationContext ?? null,
      },

      visitorContext: state.visitorContext ?? {},

      visitorType,

      previousSessionId:
        state.previousSessionId ??
        state.conversation?.previousSessionId ??
        null,

      totalSessions:
        state.totalSessions ?? state.conversation?.totalSessions ?? 1,

      isReturningVisitor,

      isPureVisitor,

      isKnownCustomer,

      isLead,

      isQuotationCustomer,

      engagement,

      metadata: {
        ...(state.metadata ?? {}),

        ...(state.currentStep
          ? {
            routing: {
              ...(state.metadata?.routing ?? {}),
              step: state.currentStep,
            },
          }
          : {}),

        ...(state.whatsapp?.phoneNumberId
          ? {
            phoneNumberId: state.whatsapp.phoneNumberId,
          }
          : {}),

        workflowStack:
          state.workflowStack ?? [],

        lastRecommendationAt:
          state.recommendationContext?.completedAt ?? null,

        /*
         * =====================================================
         * LEAD CUSTOMER COLLECTION STATE
         * =====================================================
         *
         * Persist this across WhatsApp requests so LeadAgent
         * knows whether the user is answering the current
         * collection step or starting the collection.
         */

        customerCollection: {
          started:
            state.customerCollection?.started === true,

          nameResolved:
            state.customerCollection?.nameResolved === true,

          emailResolved:
            state.customerCollection?.emailResolved === true,

          companyResolved:
            state.customerCollection?.companyResolved === true,
        },
      },

      channel: state.channel ?? state.conversation?.channel ?? "WEB",

      customerWaId:
        state.customerWaId ??
        state.whatsapp?.phoneNumber ??
        state.conversation?.customerWaId ??
        null,

      lastUserMessageAt:
        state.lastUserMessageAt ??
        state.conversation?.lastUserMessageAt ??
        null,

      lastInboundMessageId:
        state.lastInboundMessageId ??
        state.conversation?.lastInboundMessageId ??
        null,

      messages: state.history,

      status: state.status ?? state.conversation?.status ?? "ACTIVE",

      updatedAt: new Date(),
    };

    console.log("========== CONVERSATION UPDATE ==========");

    console.log({
      sessionId: state.sessionId,
      visitorId: state.visitorId,
      workflow,
      currentStep,
      requestType: conversationUpdate.requestType,
      visitorType: conversationUpdate.visitorType,
      isReturningVisitor,
      isPureVisitor,
      isKnownCustomer,
      isLead,
      isQuotationCustomer,
      hasSubmittedLead: engagement.hasSubmittedLead,
      hasRequestedQuote: engagement.hasRequestedQuote,
      hasOrdered: engagement.hasOrdered,
      historyLength: state.history.length,
    });

    /*
     * =====================================================
     * UPDATE CURRENT SESSION ONLY
     * =====================================================
     */

    try {
      state.conversation = await conversationRepository.update(
        {
          sessionId: state.sessionId,
        },
        {
          $set: conversationUpdate,

          $setOnInsert: {
            sessionId: state.sessionId,
          },
        },
        {
          upsert: true,
        },
      );

      /*
       * =====================================================
       * RELOAD CURRENT SESSION
       * =====================================================
       */

      state.conversation = await conversationRepository.findBySessionId(
        state.sessionId,
      );

      /*
       * =====================================================
       * KEEP STATE IDENTIFIERS SYNCHRONIZED
       * =====================================================
       */

      if (state.conversation) {
        state.sessionId = state.conversation.sessionId || state.sessionId;
        state.visitorId = state.conversation.visitorId || state.visitorId;
        state.conversationId =
          state.conversation._id?.toString() || state.conversationId;
        state.memory = memoryService.build(state.conversation);
      }

      if (state.persistence?.conversation) {
        state.persistence.conversation.dirty = false;
      }
    } catch (dbError) {
      console.error("[SaveSessionNode] Database conversation persistence warning:", dbError?.message);
    }

    /*
     * =====================================================
     * LINK ORDER -> LEAD
     * =====================================================
     *
     * IMPORTANT:
     *
     * Mongo/Mongoose ObjectIds must never be passed as
     * serialized BSON objects such as:
     *
     * {
     *   buffer: Uint8Array(...)
     * }
     *
     * Normalize the ID before updating the order.
     */

    let pendingLeadId = null;

    if (state.order && state.lead?._id) {
      const rawLeadId = state.lead._id;

      /*
       * Convert all supported representations to
       * a real Mongoose ObjectId.
       */
      try {
        if (rawLeadId instanceof mongoose.Types.ObjectId) {
          pendingLeadId = rawLeadId;
        } else if (
          typeof rawLeadId === "string" &&
          mongoose.Types.ObjectId.isValid(rawLeadId)
        ) {
          pendingLeadId = new mongoose.Types.ObjectId(rawLeadId);
        } else if (
          rawLeadId?._id &&
          mongoose.Types.ObjectId.isValid(String(rawLeadId._id))
        ) {
          pendingLeadId = new mongoose.Types.ObjectId(String(rawLeadId._id));
        } else if (
          rawLeadId?.buffer &&
          rawLeadId.buffer instanceof Uint8Array
        ) {
          pendingLeadId = new mongoose.Types.ObjectId(rawLeadId.buffer);
        } else if (Buffer.isBuffer(rawLeadId?.buffer)) {
          pendingLeadId = new mongoose.Types.ObjectId(rawLeadId.buffer);
        }
      } catch (error) {
        console.error("Failed to normalize leadId:", error);

        pendingLeadId = null;
      }
    }

    /*
     * =====================================================
     * PERSIST ORDER
     * =====================================================
     */

    if (state.persistence?.order?.dirty && state.order) {
      try {
        state.order.updatedAt = new Date();

        state.order = await orderRepository.saveDraft(
          state.sessionId,
          state.conversationId,
          state.order,
        );

        /*
         * Only update leadId when a valid ObjectId exists.
         */
        if (pendingLeadId) {
          const existingLeadId = state.order.leadId
            ? String(state.order.leadId)
            : null;

          const normalizedLeadId = String(pendingLeadId);

          /*
           * Compare IDs by value, not object reference.
           */
          if (existingLeadId !== normalizedLeadId) {
            let normalizedOrderId = state.order._id;
            try {
              if (normalizedOrderId?.buffer) {
                normalizedOrderId = new mongoose.Types.ObjectId(normalizedOrderId.buffer);
              } else if (typeof normalizedOrderId === "string" && mongoose.Types.ObjectId.isValid(normalizedOrderId)) {
                normalizedOrderId = new mongoose.Types.ObjectId(normalizedOrderId);
              } else if (normalizedOrderId?._id && mongoose.Types.ObjectId.isValid(String(normalizedOrderId._id))) {
                normalizedOrderId = new mongoose.Types.ObjectId(String(normalizedOrderId._id));
              }
            } catch (e) {
              // keep fallback
            }

            state.order = await orderRepository.update(normalizedOrderId, {
              leadId: pendingLeadId,
            });
          }
        }

        state.orderContext = state.order;
        state.persistence.order.dirty = false;
      } catch (orderDbError) {
        console.error("[SaveSessionNode] Database order persistence warning:", orderDbError?.message);
      }
    }

    /*
     * =====================================================
     * FINAL DEBUG
     * =====================================================
     */

    console.log("========== SESSION SAVED ==========");

    console.log({
      sessionId: state.sessionId,
      visitorId: state.visitorId,
      conversationId: state.conversationId,
      workflow: state.conversation?.workflow,
      currentStep: state.conversation?.currentStep,
      requestType: state.conversation?.requestType,
      visitorType: state.conversation?.visitorType,
      isReturningVisitor: state.conversation?.isReturningVisitor,
      isPureVisitor: state.conversation?.isPureVisitor,
      isKnownCustomer: state.conversation?.isKnownCustomer,
      isLead: state.conversation?.isLead,
      isQuotationCustomer: state.conversation?.isQuotationCustomer,
      hasSubmittedLead: state.conversation?.engagement?.hasSubmittedLead,
      hasRequestedQuote: state.conversation?.engagement?.hasRequestedQuote,
      hasOrdered: state.conversation?.engagement?.hasOrdered,
      leadId: state.order?.leadId ? String(state.order.leadId) : null,
    });

    return state;
  }
}
