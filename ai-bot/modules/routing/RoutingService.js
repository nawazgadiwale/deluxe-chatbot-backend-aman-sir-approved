import RoutingEngine from "./RoutingEngine.js";
import RoutingValidator from "./RoutingValidator.js";
import WorkflowState from "../workflow/WorkflowState.js";

const engine = new RoutingEngine();
const validator = new RoutingValidator();
const workflow = new WorkflowState();

export default class RoutingService {
  /*
   * =====================================================
   * Route Request
   * =====================================================
   */

  async route(state) {
    console.log("===== ROUTE INPUT =====");
    console.log({
      workflow: state.workflow,
      currentStep: state.currentStep,
      awaitingDecision: state.awaitingDecision,
      action: state.action,
    });

    try {
      /*
       * =====================================================
       * UI Actions
       * =====================================================
       */

      if (state.action) {
        console.log("ACTION FOUND");

        const actionRouting = engine.routeAction(state.action);

        console.log("ACTION ROUTING:", actionRouting);

        if (actionRouting) {
          return validator.validate(actionRouting);
        }
      }

      /*
       * =====================================================
       * Active Workflow
       * =====================================================
       */

      console.log("WORKFLOW ACTIVE:", workflow.isActive(state));
      if (workflow.isActive(state)) {
        console.log("ROUTING WORKFLOW");
        return this.routeWorkflow(state);
      }

      console.log("ROUTING INTENT");
      return this.routeIntent(state);
      /*
       * =====================================================
       * Normal Routing
       * =====================================================
       */

      return this.routeIntent(state);
    } catch (error) {
      console.error("Routing Error:", error);

      return validator.validate({
        capability: "out_of_scope",
        confidence: 0,
        source: "FALLBACK",
      });
    }
  }

  /*
   * =====================================================
   * Workflow Routing
   * =====================================================
   */

  async routeWorkflow(state) {
    /*
     * =====================================================
     * Continue Current Workflow
     * =====================================================
     */

    if (workflow.shouldContinue(state)) {
      return workflow.currentRouting(state);
    }

    /*
     * =====================================================
     * Check for New Intent
     * =====================================================
     */

    const routing = await this.routeIntent(state);

    /*
     * =====================================================
     * Resume Same Workflow
     * =====================================================
     */

    if (routing.capability === workflow.currentCapability(state)) {
      return workflow.currentRouting(state);
    }

    /*
     * =====================================================
     * Interrupt Workflow
     * =====================================================
     */

    if (workflow.canInterrupt(state, routing.capability)) {
      workflow.pause(state);
      return routing;
    }

    /*
     * =====================================================
     * Continue Existing Workflow
     * =====================================================
     */

    return workflow.currentRouting(state);
  }

  /*
   * =====================================================
   * Intent Routing
   * =====================================================
   */

  async routeIntent(state) {
    const routing = validator.validate(await engine.route(state));

    /*
     * =====================================================
     * Resume Workflow
     * =====================================================
     */

    if (routing.capability === "resume_workflow") {
      const resumed = workflow.resume(state);

      return resumed
        ? workflow.currentRouting(state)
        : {
            capability: "out_of_scope",
            confidence: 1,
            source: "ACTION",
          };
    }

    /*
     * =====================================================
     * Cancel Workflow
     * =====================================================
     */

    if (routing.capability === "cancel_workflow") {
      workflow.discardPausedWorkflow(state);

      return {
        capability: "out_of_scope",
        confidence: 1,
        source: "ACTION",
      };
    }

    return routing;
  }
}
