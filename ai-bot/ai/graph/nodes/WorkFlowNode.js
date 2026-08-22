import WorkflowPlanner from "../../../modules/workflow/WorkflowPlanner.js";

const planner = new WorkflowPlanner();

export default class WorkflowNode {
  async execute(state) {
    console.log("WorkflowNode");

    console.log({
      capability: state.capability,
      workflow: state.workflow,
      step: state.currentStep,
    });

    /*
     * =====================================================
     * Workflow Transition
     * =====================================================
     */

    if (state.workflowTransition) {
      state.workflowTransition = false;

      const plan = planner.plan(state.capability);

      if (!plan) {
        state.response = {
          success: false,
          type: "error",
          message: `Workflow not found for '${state.capability}'.`,
        };

        return state;
      }

      state.executionPlan = plan;
      state.currentExecutionIndex = 0;

      return state;
    }

    /*
     * =====================================================
     * Continue Existing Workflow
     * =====================================================
     */

    if (state.routing?.source === "WORKFLOW" && state.executionPlan?.length) {
      return state;
    }

    /*
     * =====================================================
     * Resume / Cancel
     * =====================================================
     */

    if (
      state.capability === "resume_workflow" ||
      state.capability === "cancel_workflow"
    ) {
      return state;
    }

    /*
     * =====================================================
     * Resolve Capability
     * =====================================================
     */

    const capability = state.capability ?? state.capabilities?.[0];

    const plan = planner.plan(capability);

    /*
     * =====================================================
     * Workflow Not Found
     * =====================================================
     */

    if (!plan) {
      state.response = {
        success: false,
        type: "error",
        message: `Workflow not found for '${capability}'.`,
      };

      return state;
    }

    /*
     * =====================================================
     * Build Execution Plan
     * =====================================================
     */

    state.executionPlan = plan;
    state.currentExecutionIndex = 0;

    return state;
  }
}
