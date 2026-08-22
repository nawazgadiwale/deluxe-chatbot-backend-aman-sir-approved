export default class ConversationMapper {
  /*
   * =====================================================
   * Mongo -> Graph State
   * =====================================================
   */

  toState(conversation) {
    if (!conversation) {
      return {
        conversation: null,
        conversationId: null,
        sessionId: null,

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

        status: "ACTIVE",
      };
    }

    return {
      conversation,

      conversationId: conversation._id?.toString() ?? null,

      sessionId: conversation.sessionId ?? null,

      customer: {
        name: null,
        phone: null,
        email: null,
        company: null,

        ...(conversation.customer ?? {}),
      },

      requestType: conversation.requestType ?? null,

      history: Array.isArray(conversation.messages)
        ? [...conversation.messages]
        : [],

      workflow: conversation.workflow ?? "NONE",

      currentStep: conversation.currentStep ?? null,

      metadata: conversation.metadata ?? {},

      status: conversation.status ?? "ACTIVE",
    };
  }
  /*
   * =====================================================
   * Graph -> Mongo
   * =====================================================
   */

  toPersistence(state) {
    return {
      customer: state.customer ?? {},

      requestType:
        state.conversation?.requestType ??
        state.leadContext?.requestType ??
        state.requestType ??
        null,

      workflow: state.workflow ?? "NONE",

      currentStep: state.currentStep ?? null,

      metadata: state.metadata ?? {},

      messages: Array.isArray(state.history) ? state.history : [],

      status: state.status ?? "ACTIVE",
    };
  }
}
