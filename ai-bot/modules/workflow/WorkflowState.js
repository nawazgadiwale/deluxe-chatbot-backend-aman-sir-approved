import WorkflowRegistry from "./WorkflowRegistry.js";
import WorkflowConfig from "./WorkflowConfig.js";
import {
  GREETING_PATTERNS,
  FAQ_PATTERNS,
  COMPARISON_PATTERNS,
  DETAIL_PATTERNS,
  SUPPORT_PATTERNS,
  LEAD_PATTERNS,
} from "../routing/utils/RoutingConstants.js";

export default class WorkflowState {
  get(workflow) {
    if (!workflow) return null;

    return WorkflowRegistry[workflow.toLowerCase()] ?? null;
  }

  getCapability(workflow) {
    return this.get(workflow)?.capability ?? null;
  }

  currentCapability(state) {
    return this.getCapability(state.workflow);
  }

  isPersistent(workflow) {
    return WorkflowConfig[workflow]?.persistent ?? false;
  }

  canInterrupt(state, capability) {
    if (!this.isActive(state)) {
      return true;
    }

    if (this.isCompleted(state)) {
      return true;
    }

    const config = WorkflowConfig[state.workflow];

    if (!config?.persistent) {
      return true;
    }

    return config.interruptibleBy.includes(capability);
  }

  clear(state) {
    switch (state.workflow) {
      case "SALES":
        state.liveRequirement = null;
        break;

      case "LEAD":
        state.leadRequest = null;
        break;

      case "RECOMMENDATION":
        state.recommendationContext = null;
        break;
    }

    state.workflow = null;
    state.currentStep = null;
    state.awaitingDecision = false;

    return state;
  }

  /*
   * =====================================================
   * Completed Workflow
   * =====================================================
   */

  isCompleted(state) {
    if (!this.isActive(state)) {
      return false;
    }

    const completed = WorkflowConfig[state.workflow]?.completed ?? [];

    return completed.includes(state.currentStep);
  }
  /*
   * =====================================================
   * Clear Workflow
   * =====================================================
   */

  shouldClear(state) {
    if (!this.isActive(state)) {
      return false;
    }

    /*
     * Clear completed workflows
     */

    if (this.isCompleted(state)) {
      return true;
    }

    /*
     * Clear non-persistent workflows
     */

    return !this.isPersistent(state.workflow);
  }

  /*
   * =====================================================
   * Pending Step
   * =====================================================
   */

  hasPendingStep(state) {
    return Boolean(state.currentStep);
  }

  /*
   * =====================================================
   * Awaiting Decision
   * =====================================================
   */

  isAwaitingDecision(state) {
    return Boolean(state.awaitingDecision);
  }

  /*
   * =====================================================
   * Active Workflow
   * =====================================================
   */

  isActive(state) {
    return Boolean(state.workflow);
  }

  /*
   * =====================================================
   * Pause & Resume Workflow
   * =====================================================
   */

  shouldPause(state, capability) {
    if (!capability) {
      return false;
    }

    if (!this.isActive(state)) {
      return false;
    }

    if (this.isCompleted(state)) {
      return false;
    }

    if (!this.isPersistent(state.workflow)) {
      return false;
    }

    if (this.currentCapability(state) === capability) {
      return false;
    }
    const config = WorkflowConfig[state.workflow];

    return config?.interruptibleBy.includes(capability);
  }

  pause(state) {
    if (!state.workflow) {
      return;
    }

    state.workflowStack ??= [];

    const last = state.workflowStack.at(-1);

    if (
      !last ||
      last.workflow !== state.workflow ||
      last.currentStep !== state.currentStep
    ) {
      state.workflowStack.push({
        workflow: state.workflow,

        currentStep: state.currentStep,

        awaitingDecision: state.awaitingDecision,

        routing: state.routing ? { ...state.routing } : null,

        recommendationContext: state.recommendationContext
          ? { ...state.recommendationContext }
          : null,

        leadRequest: state.leadRequest ? { ...state.leadRequest } : null,

        liveRequirement: state.liveRequirement
          ? { ...state.liveRequirement }
          : null,
      });
    }

    state.workflow = null;
    state.currentStep = null;
    state.awaitingDecision = false;
  }

  resume(state) {
    if (!state.workflowStack?.length) {
      return false;
    }

    const paused = state.workflowStack.pop();

    state.workflow = paused.workflow;
    state.currentStep = paused.currentStep;
    state.awaitingDecision = paused.awaitingDecision;
    state.routing = paused.routing;

    switch (paused.workflow) {
      case "RECOMMENDATION":
        state.recommendationContext = paused.recommendationContext;
        break;

      case "LEAD":
        state.leadRequest = paused.leadRequest;
        break;

      case "SALES":
        state.liveRequirement = paused.liveRequirement;
        break;
    }

    return true;
  }

  // helpers

  hasPausedWorkflow(state) {
    return Boolean(state.workflowStack?.length);
  }

  peekPausedWorkflow(state) {
    if (!state.workflowStack?.length) {
      return null;
    }

    return state.workflowStack[state.workflowStack.length - 1];
  }

  discardPausedWorkflow(state) {
    if (!state.workflowStack?.length) {
      return false;
    }

    state.workflowStack.pop();

    return true;
  }

  /*
   * =====================================================
   * Continue Current Workflow
   * =====================================================
   */

  shouldContinue(state) {
    if (!this.isActive(state)) {
      return false;
    }

    /*
     * =====================================================
     * UI Actions
     * =====================================================
     */

    if (state.action?.id) {
      return true;
    }

    if (!state.awaitingDecision) {
      return false;
    }

    if (this.isCompleted(state)) {
      return false;
    }

    /*
     * =====================================================
     * Workflow already completed
     * =====================================================
     */

    if (this.isCompleted(state)) {
      return false;
    }

    const text = (state.userMessage ?? "").trim().toLowerCase();

    if (!text) {
      return false;
    }

    /*
     * =====================================================
     * Greetings
     * =====================================================
     */

    if (GREETING_PATTERNS.some((pattern) => pattern.test(text))) {
      return false;
    }

    /*
     * =====================================================
     * FAQ
     * =====================================================
     */

    if (FAQ_PATTERNS.some((pattern) => pattern.test(text))) {
      return false;
    }

    /*
     * =====================================================
     * Product Details
     * =====================================================
     */

    if (DETAIL_PATTERNS.some((pattern) => pattern.test(text))) {
      return false;
    }

    /*
     * =====================================================
     * Comparison
     * =====================================================
     */

    if (COMPARISON_PATTERNS.some((pattern) => pattern.test(text))) {
      return false;
    }

    /*
     * =====================================================
     * Support
     * =====================================================
     */

    if (SUPPORT_PATTERNS.some((pattern) => pattern.test(text))) {
      return false;
    }

    /*
     * =====================================================
     * Lead / Quote
     * =====================================================
     */

    if (LEAD_PATTERNS.some((pattern) => pattern.test(text))) {
      return false;
    }

    /*
     * =====================================================
     * Order Intent
     * =====================================================
     */

    if (
      /\b(order|buy|purchase|checkout|quantity|qty|place order)\b/i.test(text)
    ) {
      return false;
    }

    /*
     * =====================================================
     * Everything else belongs to the current workflow.
     * Let RecommendationQuestionEngine / OrderEngine
     * interpret the answer.
     * =====================================================
     */

    return true;
  }
  /*
   * =====================================================
   * Current Workflow Routing
   * =====================================================
   */

  currentRouting(state) {
    const capability = this.currentCapability(state);

    return {
      capability,
      capabilities: [capability],
      confidence: 1,
      source: "WORKFLOW",
    };
  }
}
