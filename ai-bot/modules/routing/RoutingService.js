import RoutingEngine from "./RoutingEngine.js";
import RoutingValidator from "./RoutingValidator.js";
import WorkflowState from "../workflow/WorkflowState.js";

const engine = new RoutingEngine();
const validator = new RoutingValidator();
const workflow = new WorkflowState();

export default class RoutingService {
  async route(state) {
    try {
      // 1. UI Actions
      if (state.action) {
        const actionRouting = engine.routeAction(state.action);
        if (actionRouting) {
          console.log("[WhatsApp][Routing] classification=ACTION");
          return validator.validate(actionRouting);
        }
      }

      // 2. Active Workflow
      if (workflow.isActive(state)) {
        return this.routeWorkflow(state);
      }

      // 3. Intent Routing
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

  async routeWorkflow(state) {
    // Continue current workflow if condition met
    if (workflow.shouldContinue(state)) {
      console.log("[WhatsApp][Routing] classification=WORKFLOW");
      console.log("[WhatsApp Interactive] ACTIVE_WORKFLOW_PRESERVED:", {
        workflow: state.workflow,
        currentStep: state.currentStep,
        awaitingDecision: state.awaitingDecision,
      });
      return workflow.currentRouting(state);
    }

    // Check for new intent
    const routing = await this.routeIntent(state);

    // Resume same workflow
    if (routing.capability === workflow.currentCapability(state)) {
      console.log("[WhatsApp][Routing] classification=WORKFLOW");
      return workflow.currentRouting(state);
    }

    // Check if new capability can interrupt active workflow
    if (workflow.canInterrupt(state, routing.capability)) {
      const capName = String(routing.capability || "").toUpperCase();
      const classification =
        capName === "GREETING"
          ? "GREETING"
          : capName === "FAQ" || capName === "SUPPORT"
            ? "FAQ"
            : capName === "SALES"
              ? "NEW_PRODUCT"
              : capName;
      console.log(`[WhatsApp][Routing] classification=${classification}`);
      workflow.pause(state);
      return routing;
    }

    // Otherwise preserve existing workflow
    console.log("[WhatsApp][Routing] classification=WORKFLOW");
    console.log("[WhatsApp Interactive] ACTIVE_WORKFLOW_PRESERVED:", {
      workflow: state.workflow,
      currentStep: state.currentStep,
      awaitingDecision: state.awaitingDecision,
      attemptedInterruptBy: routing.capability,
    });
    return workflow.currentRouting(state);
  }

  async routeIntent(state) {
    const routing = validator.validate(await engine.route(state));

    if (routing.capability === "resume_workflow") {
      const resumed = workflow.resume(state);
      return resumed
        ? workflow.currentRouting(state)
        : { capability: "out_of_scope", confidence: 1, source: "ACTION" };
    }

    if (routing.capability === "cancel_workflow") {
      workflow.discardPausedWorkflow(state);
      return { capability: "out_of_scope", confidence: 1, source: "ACTION" };
    }

    return routing;
  }
}
