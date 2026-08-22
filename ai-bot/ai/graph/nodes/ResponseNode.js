export default class WorkflowNode {
  async execute(state) {
    const capabilities = Array.isArray(state.capabilities)
      ? state.capabilities
      : [];

    const capability = capabilities[0] ?? "recommendation";

    // console.log("Workflow :", state.workflow);
    // console.log("Current Step :", state.currentStep);
    // console.log("Capability :", capability);

    /*
     * =====================================================
     * GLOBAL INTERRUPTS
     * These can happen from ANY workflow.
     * =====================================================
     */

    /*
     * FAQ / SUPPORT
     */

    if (capability === "faq" || capability === "support") {
      return this.route(state, "FAQNode", "faq");
    }

    /*
     * LEAD
     */

    if (capability === "lead") {
      if (state.workflow !== "LEAD") {
        state.previousWorkflow = state.workflow;
      }

      return this.route(state, "LeadNode", "lead");
    }

    /*
     * =====================================================
     * RECOMMENDATION -> ORDER
     * =====================================================
     */

    if (
      state.workflow === "RECOMMENDATION" &&
      state.awaitingDecision &&
      capability === "order"
    ) {
      state.previousWorkflow = "RECOMMENDATION";

      return this.route(state, "OrderNode", "order");
    }

    /*
     * =====================================================
     * ORDER -> RECOMMENDATION
     * Allow user to ask for more recommendations
     * while ordering.
     * =====================================================
     */

    if (state.workflow === "ORDER" && capability === "recommendation") {
      state.previousWorkflow = "ORDER";

      return this.route(state, "RecommendationNode", "recommendation");
    }

    /*
     * =====================================================
     * RESUME ACTIVE ORDER
     * =====================================================
     */

    if (
      state.workflow === "ORDER" &&
      state.currentStep &&
      state.currentStep !== "ORDER_COMPLETED"
    ) {
      return this.route(state, "OrderNode", "order");
    }

    /*
     * =====================================================
     * RESUME ACTIVE LEAD
     * =====================================================
     */

    if (
      state.workflow === "LEAD" &&
      state.currentStep &&
      state.currentStep !== "LEAD_COMPLETED"
    ) {
      return this.route(state, "LeadNode", "lead");
    }

    /*
     * =====================================================
     * RESUME RECOMMENDATION
     * =====================================================
     */

    if (state.workflow === "RECOMMENDATION" && state.awaitingDecision) {
      return this.route(state, "RecommendationNode", "recommendation");
    }

    /*
     * =====================================================
     * FRESH REQUEST
     * =====================================================
     */

    switch (capability) {
      case "order":
        return this.route(state, "OrderNode", "order");

      case "lead":
        return this.route(state, "LeadNode", "lead");

      case "faq":
      case "support":
        return this.route(state, "FAQNode", "faq");

      default:
        return this.route(state, "RecommendationNode", "recommendation");
    }
  }

  route(state, node, capability) {
    state.executionPlan = [
      {
        node,
        capability,
      },
    ];

    // state.currentExecutionIndex = 0;
    // console.log("====== RESPONSE NODE ======");
    // console.log(state.persistence);
    // console.log("===========================");

    return state;
  }
}
