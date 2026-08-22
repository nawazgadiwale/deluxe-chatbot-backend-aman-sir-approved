export default class MemoryService {
  create(sessionId = null) {
    return {
      sessionId,

      customer: {
        name: null,
        mobile: null,
        email: null,
        company: null,
      },

      workflow: null,

      currentStep: null,

      leadRequest: null,

      recommendation: null,

      selectedProduct: null,

      productSales: null,

      comparison: null,

      comparisonContext: null,

      comparisonProducts: [],

      recommendationContext: {
        active: false,

        customerType: null,

        businessType: null,

        businessGoals: [],

        requirements: [],

        targetAudience: [],

        campaigns: [],

        constraints: [],

        liveRequirement: null,

        productSales: null,

        originalQuery: null,

        catalogProducts: [],

        products: [],

        extracted: false,

        page: 1,

        hasMore: false,
      },
      metadata: {},
    };
  }

  build(conversation = null) {
    if (!conversation) {
      return this.create();
    }

    return {
      sessionId: conversation.sessionId,

      customer: {
        name: null,
        mobile: null,
        email: null,
        company: null,
        ...(conversation.customer ?? {}),
      },

      liveRequirement:
        conversation.memory?.liveRequirement ??
        conversation.memory?.productSales ??
        null,

      productSales:
        conversation.memory?.productSales ??
        conversation.memory?.liveRequirement ??
        null,

      workflow: conversation.workflow ?? null,

      currentStep: conversation.currentStep ?? null,
      selectedProduct: null,

      recommendation: conversation.memory?.recommendation ?? null,

      recommendationContext: {
        active: false,

        customerType: null,

        businessType: null,

        businessGoals: [],

        requirements: [],

        targetAudience: [],

        campaigns: [],

        constraints: [],

        originalQuery: null,

        catalogProducts: [],

        products: [],

        extracted: false,

        page: 1,

        hasMore: false,

        ...(conversation.memory?.recommendationContext ?? {}),
      },
      selectedProduct: conversation.memory?.selectedProduct ?? null,

      comparison: conversation.memory?.comparison ?? null,

      comparisonContext: conversation.memory?.comparisonContext ?? null,

      comparisonProducts: conversation.memory?.comparisonProducts ?? [],

      metadata: conversation.metadata ?? {},
    };
  }

  merge(memory = {}, state = {}) {
    return {
      ...memory,

      customer: state.customer ?? memory.customer,

      workflow: state.workflow ?? memory.workflow,

      currentStep: state.currentStep ?? memory.currentStep,

      leadRequest: state.leadRequest ?? memory.leadRequest,

      liveRequirement:
        state.liveRequirement ?? memory.liveRequirement ?? memory.productSales,

      productSales:
        state.productSales ?? state.liveRequirement ?? memory.productSales,

      recommendation: state.recommendation ?? memory.recommendation,

      recommendationContext: {
        ...(memory.recommendationContext ?? {}),
        ...(state.recommendationContext ?? {}),

        businessGoals: [
          ...new Set([
            ...(memory.recommendationContext?.businessGoals ?? []),
            ...(state.recommendationContext?.businessGoals ?? []),
          ]),
        ],

        requirements: [
          ...new Set([
            ...(memory.recommendationContext?.requirements ?? []),
            ...(state.recommendationContext?.requirements ?? []),
          ]),
        ],

        targetAudience: [
          ...new Set([
            ...(memory.recommendationContext?.targetAudience ?? []),
            ...(state.recommendationContext?.targetAudience ?? []),
          ]),
        ],

        campaigns: [
          ...new Set([
            ...(memory.recommendationContext?.campaigns ?? []),
            ...(state.recommendationContext?.campaigns ?? []),
          ]),
        ],

        constraints: [
          ...new Set([
            ...(memory.recommendationContext?.constraints ?? []),
            ...(state.recommendationContext?.constraints ?? []),
          ]),
        ],
      },
      selectedProduct: state.selectedProduct ?? memory.selectedProduct,

      comparison: state.comparison ?? memory.comparison,

      comparisonContext: state.comparisonContext ?? memory.comparisonContext,

      comparisonProducts: state.comparisonProducts ?? memory.comparisonProducts,

      metadata: {
        ...(memory.metadata ?? {}),
        ...(state.metadata ?? {}),
      },
    };
  }
}
