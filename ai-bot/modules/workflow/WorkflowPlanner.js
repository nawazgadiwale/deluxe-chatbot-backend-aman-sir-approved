import WorkflowRegistry from "./WorkflowRegistry.js";

export default class WorkflowPlanner {
  /*
   * =====================================================
   * Build Execution Plan
   * =====================================================
   */

  plan(capability) {
    const workflow = WorkflowRegistry[capability];

    if (!workflow) {
      return null;
    }

    return [
      {
        capability: workflow.capability,
        node: workflow.node,
        persistent: workflow.persistent,
        workflow: workflow.workflow ?? null,
      },
    ];
  }

  /*
   * =====================================================
   * Helpers
   * =====================================================
   */

  exists(capability) {
    return capability in WorkflowRegistry;
  }

  get(capability) {
    return WorkflowRegistry[capability] ?? null;
  }

  getNode(capability) {
    return WorkflowRegistry[capability]?.node ?? null;
  }

  isPersistent(capability) {
    return WorkflowRegistry[capability]?.persistent ?? false;
  }

  getWorkflow(capability) {
    return WorkflowRegistry[capability]?.workflow ?? null;
  }
}
