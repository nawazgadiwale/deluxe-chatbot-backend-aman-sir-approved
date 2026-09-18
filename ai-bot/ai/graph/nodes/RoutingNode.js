// import RoutingService from "../../../modules/routing/RoutingService.js";

// const routingService = new RoutingService();

// export default class RoutingNode {
//   async execute(state) {
//     /*
//      * =====================================================
//      * Resolve Route
//      * =====================================================
//      */

//     const routing = await routingService.route(state);

//     /*
//      * =====================================================
//      * Apply Routing
//      * =====================================================
//      */

//     state.routing = routing;

//     state.capability = routing.capability;

//     state.capabilities = routing.capabilities ?? [routing.capability];

//     state.routingConfidence = routing.confidence ?? 1;

//     /*
//      * =====================================================
//      * Preserve Request Type
//      * =====================================================
//      */

//     if (routing.requestType) {
//       state.requestType = routing.requestType;

//       state.leadContext = {
//         ...(state.leadContext ?? {}),
//         requestType: routing.requestType,
//       };
//     }

//     /*
//      * =====================================================
//      * Metadata
//      * =====================================================
//      */

//     state.metadata = {
//       ...(state.metadata ?? {}),
//       routing,
//     };

//     return state;
//   }
// }


import RoutingService from "../../../modules/routing/RoutingService.js";

const routingService = new RoutingService();

export default class RoutingNode {
  async execute(state) {
    const totalSessions = Number.isFinite(state.totalSessions)
      ? state.totalSessions
      : 1;

    const isNewVisitor =
      state.isPureVisitor === true &&
      !state.hasOrdered &&
      !state.hasSubmittedLead &&
      !state.hasRequestedQuote &&
      !state.hasRequirement &&
      !state.leadId &&
      !state.isReturningVisitor &&
      totalSessions <= 1 &&
      !state.previousSessionId &&
      (!state.history || state.history.length === 0);

    const isReturning =
      !isNewVisitor &&
      (state.isReturningVisitor === true ||
        state.isKnownCustomer === true ||
        state.hasSubmittedLead === true ||
        state.hasRequestedQuote === true ||
        state.hasOrdered === true ||
        state.hasRequirement === true ||
        Boolean(state.conversationId) ||
        Boolean(state.leadId));

    console.log("[RoutingNode] State before routing:", {
      "customer.name": state.customer?.name ?? null,
      isReturning,
      workflow: state.workflow ?? null,
      currentStep: state.currentStep ?? null,
      classification:
        state.routing?.classification ?? state.classification ?? null,
      capability: state.capability ?? null,
      selectedProduct:
        state.selectedProduct?.name ??
        state.selectedProduct?.id ??
        state.selectedProduct ??
        null,
    });

    /*
     * =====================================================
     * Resolve Route
     * =====================================================
     */

    const routing = await routingService.route(state);

    /*
     * =====================================================
     * Apply Routing
     * =====================================================
     */

    state.routing = routing;

    state.capability = routing.capability;

    state.capabilities = routing.capabilities ?? [routing.capability];

    state.routingConfidence = routing.confidence ?? 1;

    console.log("[RoutingNode] State after routing:", {
      "customer.name": state.customer?.name ?? null,
      isReturning,
      workflow: state.workflow ?? null,
      currentStep: state.currentStep ?? null,
      classification:
        routing.classification ?? routing.source ?? routing.type ?? null,
      capability: routing.capability ?? null,
      selectedProduct:
        state.selectedProduct?.name ??
        state.selectedProduct?.id ??
        state.selectedProduct ??
        null,
    });

    /*
     * =====================================================
     * Preserve Request Type
     * =====================================================
     */

    if (routing.requestType) {
      state.requestType = routing.requestType;

      state.leadContext = {
        ...(state.leadContext ?? {}),
        requestType: routing.requestType,
      };
    }

    /*
     * =====================================================
     * Metadata
     * =====================================================
     */

    state.metadata = {
      ...(state.metadata ?? {}),
      routing,
    };

    return state;
  }
}
