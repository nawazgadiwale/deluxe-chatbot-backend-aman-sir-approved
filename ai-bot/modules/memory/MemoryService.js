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
      selectedProduct:
        conversation.memory?.selectedProduct ??
        (conversation.memory?.liveRequirement?.items?.[
          conversation.memory?.liveRequirement?.currentItem ?? 0
        ]?.selectedProduct ??
          conversation.memory?.liveRequirement?.items?.[
            conversation.memory?.liveRequirement?.currentItem ?? 0
          ]?.selection ??
          conversation.memory?.liveRequirement?.items?.[
            conversation.memory?.liveRequirement?.currentItem ?? 0
          ]?.product ??
          null),

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

      comparison: conversation.memory?.comparison ?? null,

      comparisonContext: conversation.memory?.comparisonContext ?? null,

      comparisonProducts: conversation.memory?.comparisonProducts ?? [],

      metadata: conversation.metadata ?? {},
    };
  }

  merge(memory = {}, state = {}) {
    // If state explicitly cleared liveRequirement (null), do not fall back to old memory
    const liveReq =
      state.liveRequirement === null
        ? null
        : (state.liveRequirement ??
          (state.productSales === null
            ? null
            : (state.productSales ??
              (state.workflow === "NONE" ? null : (memory.liveRequirement ?? memory.productSales ?? null)))));

    const currentItem =
      liveReq?.items?.[liveReq?.currentItem ?? 0] ?? null;

    const resolvedProduct =
      state.selectedProduct === null || liveReq === null || state.workflow === "NONE"
        ? null
        : (state.selectedProduct ??
          currentItem?.selectedProduct ??
          currentItem?.selection ??
          currentItem?.product ??
          memory.selectedProduct ??
          null);

    const resolvedWorkflow =
      state.workflow === null || state.workflow === "NONE"
        ? null
        : (state.workflow ?? memory.workflow);

    const resolvedCurrentStep =
      state.currentStep === null || state.workflow === "NONE"
        ? null
        : (state.currentStep ?? memory.currentStep);

    return {
      ...memory,

      customer: state.customer ?? memory.customer,

      workflow: resolvedWorkflow,

      currentStep: resolvedCurrentStep,

      leadRequest: state.leadRequest === null ? null : (state.leadRequest ?? memory.leadRequest),

      liveRequirement: liveReq,

      productSales: liveReq,

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
      selectedProduct: resolvedProduct,

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
