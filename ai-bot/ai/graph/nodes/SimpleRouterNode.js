export default class SimpleRouterNode {
  async execute(state) {
    return state;
  }

  next(state) {
    const plan = state.executionPlan ?? [];

    if (plan.length === 0) {
      return "ResponseNode";
    }

    return plan[0].node;
  }
}
