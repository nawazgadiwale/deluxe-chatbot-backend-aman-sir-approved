import WorkflowPlanner from "../../../modules/workflow/WorkflowPlanner.js";

const planner = new WorkflowPlanner();

const CANCELLATION_REGEX =
  /^(cancel|cancel order|cancelled|canceling|i want to cancel|please cancel|cancel please|stop|restart|start over|start again|reset|quit|exit|nevermind|i don't want this anymore|i dont want this anymore)$/i;

export default class WorkflowNode {
  async execute(state = {}) {
    console.log("WorkflowNode");

    console.log({
      capability: state.capability,
      workflow: state.workflow,
      step: state.currentStep,
      action: state.action?.id ?? null,
    });

    /*
     * =====================================================
     * GLOBAL CANCELLATION
     * =====================================================
     */

    const isCancellation =
      state.action?.id === "CANCEL_ORDER" ||
      state.routing?.action?.id === "CANCEL_ORDER" ||
      CANCELLATION_REGEX.test(
        String(state.userMessage ?? "").trim(),
      );

    if (isCancellation) {
      console.log(
        "[WorkflowNode] Cancellation detected. Routing directly to SalesNode.",
      );

      state.action = {
        id: "CANCEL_ORDER",
        type: "CANCEL_ORDER",
        label: "Cancel Order",
        payload: {
          text: state.userMessage ?? "",
        },
      };

      state.workflow = "SALES";

      /*
       * SalesNode owns the actual cancellation/reset.
       * WorkflowNode only guarantees that CANCEL_ORDER
       * reaches SalesNode without creating/restoring
       * transient workflow state.
       */
      state.transientExecution = null;

      state.executionPlan = [
        {
          capability: "sales",
          node: "SalesNode",
          persistent: true,
          workflow: "SALES",
        },
      ];

      state.currentExecutionIndex = 0;

      return state;
    }

    /*
     * =====================================================
     * WORKFLOW TRANSITION
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
     * CONTINUE EXISTING WORKFLOW
     * =====================================================
     */

    if (
      state.routing?.source === "WORKFLOW" &&
      state.executionPlan?.length
    ) {
      return state;
    }

    /*
     * =====================================================
     * RESUME / CANCEL WORKFLOW
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
     * RESOLVE CAPABILITY
     * =====================================================
     */

    const capability =
      state.capability ??
      state.capabilities?.[0];

    const plan = planner.plan(capability);

    /*
     * =====================================================
     * WORKFLOW NOT FOUND
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
     * BUILD EXECUTION PLAN
     * =====================================================
     */

    const isPersistent = planner.isPersistent(capability);

    if (!isPersistent) {
      state.transientExecution = {
        active: true,
        capability,

        persistentWorkflow:
          state.workflow ?? null,

        persistentStep:
          state.currentStep ?? null,

        persistentOrder:
          state.order ?? null,

        persistentOrderContext:
          state.orderContext ?? null,

        persistentSelectedProduct:
          state.selectedProduct ?? null,

        persistentSelectedProductId:
          state.selectedProductId ?? null,

        persistentProduct:
          state.product ?? null,

        persistentProductId:
          state.productId ?? null,

        persistentSelection:
          state.selection ?? null,

        persistentSelectionId:
          state.selectionId ?? null,

        persistentLiveRequirement:
          state.liveRequirement ?? null,

        persistentProductSales:
          state.productSales ?? null,

        persistentAwaitingDecision:
          state.awaitingDecision ?? false,
      };
    } else {
      state.transientExecution = null;
    }

    state.executionPlan = plan;
    state.currentExecutionIndex = 0;

    return state;
  }
}