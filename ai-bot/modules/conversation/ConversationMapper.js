export default class ConversationMapper {
  toState(conversation) {
    if (!conversation) {
      return {
        conversation: null,
        conversationId: null,
        sessionId: null,
        ipAddress: null,
        visitorId: null,
        site: "exprintmart",

        visitorType: "VISITOR",
        previousSessionId: null,
        totalSessions: 1,

        isReturningVisitor: false,
        isPureVisitor: true,
        isKnownCustomer: false,
        isLead: false,
        isQuotationCustomer: false,

        customer: {
          name: null,
          phone: null,
          email: null,
          company: null,
        },

        requestType: null,
        history: [],
        workflow: "NONE",
        currentStep: null,

        metadata: {},
        memory: {},
        visitorContext: {},

        engagement: {
          hasSearched: false,
          hasViewedProduct: false,
          hasStartedOrder: false,
          hasSubmittedLead: false,
          hasOrdered: false,
          hasRequestedQuote: false,
          abandoned: false,
          lastActivityAt: null,
        },

        status: "ACTIVE",
      };
    }

    const customer = {
      name: null,
      phone: null,
      email: null,
      company: null,
      ...(conversation.customer ?? {}),
    };

    const requestType = conversation.requestType ?? null;

    const history = Array.isArray(conversation.messages)
      ? [...conversation.messages]
      : [];

    const engagement = {
      hasSearched: conversation.engagement?.hasSearched ?? false,
      hasViewedProduct: conversation.engagement?.hasViewedProduct ?? false,
      hasStartedOrder: conversation.engagement?.hasStartedOrder ?? false,
      hasSubmittedLead: conversation.engagement?.hasSubmittedLead ?? false,
      hasOrdered: conversation.engagement?.hasOrdered ?? false,
      hasRequestedQuote: conversation.engagement?.hasRequestedQuote ?? false,
      abandoned: conversation.engagement?.abandoned ?? false,
      lastActivityAt: conversation.engagement?.lastActivityAt ?? null,
    };

    const totalSessions = conversation.totalSessions ?? 1;

    const isReturningVisitor =
      conversation.isReturningVisitor !== undefined
        ? conversation.isReturningVisitor
        : totalSessions > 1 || Boolean(conversation.previousSessionId);

    const isKnownCustomer =
      conversation.isKnownCustomer !== undefined
        ? conversation.isKnownCustomer
        : engagement.hasOrdered === true;

    const isQuotationCustomer =
      conversation.isQuotationCustomer !== undefined
        ? conversation.isQuotationCustomer
        : requestType === "QUOTATION" || engagement.hasRequestedQuote === true;

    const isLead =
      conversation.isLead !== undefined
        ? conversation.isLead
        : engagement.hasSubmittedLead === true;

    const isPureVisitor =
      conversation.isPureVisitor !== undefined
        ? conversation.isPureVisitor
        : !isKnownCustomer && !isQuotationCustomer && !isLead;

    const visitorType =
      conversation.visitorType ??
      (isKnownCustomer
        ? "CUSTOMER"
        : isQuotationCustomer
          ? "QOUTATION"
          : isLead
            ? "LEAD"
            : "VISITOR");

    return {
      conversation,

      conversationId: conversation._id?.toString() ?? null,

      sessionId: conversation.sessionId ?? null,

      ipAddress: conversation.ipAddress ?? null,

      visitorId: conversation.visitorId ?? null,

      site: conversation.site ?? "exprintmart",

      visitorType,

      previousSessionId: conversation.previousSessionId ?? null,

      totalSessions,

      isReturningVisitor,
      isPureVisitor,
      isKnownCustomer,
      isLead,
      isQuotationCustomer,

      customer,

      requestType,

      history,

      workflow: conversation.workflow ?? "NONE",

      currentStep: conversation.currentStep ?? null,

      memory: conversation.memory ?? {},

      visitorContext: conversation.visitorContext ?? {},

      engagement,

      metadata: conversation.metadata ?? {},

      channel: conversation.channel ?? "WEB",

      customerWaId: conversation.customerWaId ?? null,

      lastUserMessageAt: conversation.lastUserMessageAt ?? null,

      lastInboundMessageId: conversation.lastInboundMessageId ?? null,

      status: conversation.status ?? "ACTIVE",
    };
  }

  toPersistence(state) {
    const customer = state.customer ?? {};

    const requestType =
      state.conversation?.requestType ??
      state.leadContext?.requestType ??
      state.requestType ??
      null;

    const engagement = state.engagement ?? {};

    const totalSessions =
      state.totalSessions ?? state.conversation?.totalSessions ?? 1;

    const isReturningVisitor =
      state.isReturningVisitor !== undefined
        ? state.isReturningVisitor
        : totalSessions > 1 || Boolean(state.previousSessionId);

    const isKnownCustomer =
      state.isKnownCustomer !== undefined
        ? state.isKnownCustomer
        : engagement.hasOrdered === true;

    const isQuotationCustomer =
      state.isQuotationCustomer !== undefined
        ? state.isQuotationCustomer
        : requestType === "QUOTATION" || engagement.hasRequestedQuote === true;

    const isLead =
      state.isLead !== undefined
        ? state.isLead
        : engagement.hasSubmittedLead === true;

    const isPureVisitor =
      state.isPureVisitor !== undefined
        ? state.isPureVisitor
        : !isKnownCustomer && !isQuotationCustomer && !isLead;

    const visitorType =
      state.visitorType ??
      (isKnownCustomer
        ? "CUSTOMER"
        : isQuotationCustomer
          ? "QOUTATION"
          : isLead
            ? "LEAD"
            : "VISITOR");

    return {
      visitorId: state.visitorId ?? null,

      site: state.site ?? "exprintmart",

      ipAddress: state.ipAddress ?? null,

      customer,

      requestType,

      workflow: state.workflow ?? "NONE",

      currentStep: state.currentStep ?? null,

      memory: state.memory ?? {},

      visitorContext: state.visitorContext ?? {},

      engagement,

      metadata: {
        ...(state.metadata ?? {}),
        ...(state.whatsapp?.phoneNumberId
          ? { phoneNumberId: state.whatsapp.phoneNumberId }
          : {}),
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

      messages: Array.isArray(state.history) ? state.history : [],

      status: state.status ?? "ACTIVE",

      visitorType,

      previousSessionId: state.previousSessionId ?? null,

      totalSessions,

      isReturningVisitor,
      isPureVisitor,
      isKnownCustomer,
      isLead,
      isQuotationCustomer,
    };
  }
}
