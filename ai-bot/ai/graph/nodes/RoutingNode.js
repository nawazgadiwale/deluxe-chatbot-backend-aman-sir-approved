import RoutingService from "../../../modules/routing/RoutingService.js";

const routingService = new RoutingService();

export default class RoutingNode {
  async execute(state) {
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
