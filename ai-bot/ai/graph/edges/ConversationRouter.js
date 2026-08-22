export default class ConversationRouter {
  /*
   * =====================================================
   * Current Execution
   * =====================================================
   */

  current(state) {
    const plan = state.executionPlan ?? [];
    const index = state.currentExecutionIndex ?? 0;

    if (!plan.length) {
      return null;
    }

    if (index < 0 || index >= plan.length) {
      return null;
    }

    return plan[index];
  }

  /*
   * =====================================================
   * First Node
   * =====================================================
   */

  route(state) {
    console.log("Execution Plan:", state.executionPlan);
    console.log("Current:", this.current(state));

    return this.current(state)?.node ?? "ResponseNode";
  }

  /*
   * =====================================================
   * Next Node
   * =====================================================
   */

  continue(state) {
    state.currentExecutionIndex = (state.currentExecutionIndex ?? 0) + 1;

    return this.route(state);
  }

  /*
   * =====================================================
   * Helpers
   * =====================================================
   */

  hasNext(state) {
    const plan = state.executionPlan ?? [];

    return (state.currentExecutionIndex ?? 0) + 1 < plan.length;
  }

  currentCapability(state) {
    return this.current(state)?.capability ?? null;
  }

  currentWorkflow(state) {
    return this.current(state)?.workflow ?? null;
  }

  /*
   * =====================================================
   * Reset
   * =====================================================
   */

  reset(state) {
    state.executionPlan = [];
    state.currentExecutionIndex = 0;

    // console.log("Execution Plan");
    // console.dir(state.executionPlan, { depth: null });

    return "ResponseNode";
  }
}
