import GreetingClassifier from "./classifiers/GreetingClassifier.js";
import SemanticProductRouter from "./classifiers/SemanticProductRouter.js";
import FAQClassifier from "./classifiers/FAQClassifier.js";
import SupportClassifier from "./classifiers/SupportClassifier.js";
import IntentRouter from "./classifiers/IntentRouter.js";
import { WORKFLOW_ANSWER_PATTERNS } from "./utils/RoutingConstants.js";

const PRODUCT_DETAILS_ACTIONS = new Set([
  "SHOW_PRODUCT_DETAILS",
  "RELATED_PRODUCT",
  "SHOW_RELATED_PRODUCT",
]);

const SALES_ACTIONS = new Set([
  "START_ORDER",
  "CONTINUE_ORDER",
  "SELECT_PRODUCT",
  "SELECT_VARIANT",
  "SELECT_SELECTION",
  "SELECT_NESTED_PRODUCT",
  "SELECT_CATEGORY",
  "BROWSE_CATEGORY",
  "SHOW_SELECTIONS",
  "SELECT_SPECIFICATIONS",
  "ASK_ARTWORK",
  "ASK_QUANTITY",
  "ASK_NUMBER_OF_NAMES",
  "SELECT_DELIVERY_METHOD",
  "ASK_DELIVERY_ADDRESS",
  "ASK_DELIVERY_DATE",
  "REVIEW_ORDER",
  "COMPLETE_ORDER",
  "CONFIRM_ORDER",
  "EDIT_ORDER",
  "ADD_RELATED_PRODUCT",
  "ADD_MORE_ITEMS",
  "ADD_MORE_PRODUCTS",
  "REMOVE_ITEM",
  "CLEAR_ORDER",
  "CANCEL_ORDER",
  "BROWSE_PRODUCTS",
  "UNKNOWN_PRODUCT",
  "ORDER_NOW",
  "SUBMIT_ORDER_FORM",
  "SET_FORM_FIELD",
  "FORM_FIELD_VALUE",
  "SET_CUSTOMER_FIELD",
]);

const CANCELLATION_REGEX =
  /^(cancel|cancel order|cancelled|stop|restart|start over|start again|reset|quit|exit|nevermind|i don't want this anymore|i dont want this anymore)$/i;

const CANCELLATION_PHRASE_REGEX =
  /\b(cancel order|cancel my order|cancel the order|stop order|restart bot|restart chat)\b/i;

const HUMAN_HANDOFF_REGEX =
  /^(human|agent|talk to (an? )?human|talk to (an? )?agent|representative|executive|expert|live agent)$/i;

const HUMAN_HANDOFF_PHRASE_REGEX =
  /\b(talk to (an? )?(expert|agent|human)|connect to (an? )?(agent|human)|speak with (an? )?(human|agent))\b/i;

export default class RoutingEngine {
  constructor() {
    this.greeting = new GreetingClassifier();
    this.productRouter = new SemanticProductRouter();
    this.faq = new FAQClassifier();
    this.support = new SupportClassifier();
    this.intentRouter = new IntentRouter();
  }

  async route(state = {}) {
    // 1. Normalize UI action
    const normalizedAction = this.normalizeAction(state.action, state);

    // 2. Explicit UI action routing
    const actionRoute = this.routeAction(normalizedAction);
    if (actionRoute) {
      return actionRoute;
    }

    const rawMsg = (state.userMessage ?? "").trim().toLowerCase();

    // 3. Global interruption: Cancellation / restart
    const isExplicitCancellation =
      CANCELLATION_REGEX.test(rawMsg) || CANCELLATION_PHRASE_REGEX.test(rawMsg);

    if (isExplicitCancellation) {
      console.log("[RoutingEngine] Global interruption: CANCELLATION detected");
      return {
        capability: "sales",
        capabilities: ["sales"],
        confidence: 1,
        source: "ACTION",
        workflow: "SALES",
        action: {
          id: "CANCEL_ORDER",
          label: "Cancel Order",
          payload: { text: rawMsg },
        },
      };
    }

    // 4. Global interruption: Human handoff
    const isExplicitHumanHandoff =
      HUMAN_HANDOFF_REGEX.test(rawMsg) ||
      HUMAN_HANDOFF_PHRASE_REGEX.test(rawMsg);

    if (isExplicitHumanHandoff) {
      console.log(
        "[RoutingEngine] Global interruption: HUMAN_HANDOFF detected",
      );
      return {
        capability: "lead",
        capabilities: ["lead"],
        confidence: 1,
        source: "ACTION",
        requestType: "CONTACT_SALES",
        workflow: "LEAD",
        step: "COLLECT_CUSTOMER",
        action: {
          id: "HUMAN_HANDOFF",
          label: "Talk to Expert",
          payload: { text: rawMsg },
        },
      };
    }

    // 5. Explicit FAQ
    const faq = this.faq.classify(state);
    if (faq) {
      return faq;
    }

    // 6. Explicit Support
    const support = this.support.classify(state);
    if (support) {
      return support;
    }

    // 7. Active workflow check
    const hasActiveWorkflow =
      (state.workflow === "SALES" &&
        (state.currentStep === "ORDER_FORM" ||
          state.currentStep === "COLLECT_CUSTOMER" ||
          state.currentStep === "REVIEW_ORDER" ||
          state.currentStep === "ORDER_REVIEW" ||
          state.awaitingDecision ||
          state.liveRequirement != null)) ||
      (state.workflow === "LEAD" &&
        (state.currentStep === "COLLECT_CUSTOMER" ||
          state.currentStep === "LEAD_FORM")) ||
      state.routing?.source === "WORKFLOW";

    const isWorkflowAnswer =
      hasActiveWorkflow &&
      (state.currentStep === "COLLECT_CUSTOMER" ||
        WORKFLOW_ANSWER_PATTERNS.some((p) => p.test(rawMsg)) ||
        /^\d+$/.test(rawMsg) ||
        /^(dubai|uae|sharjah|abu dhabi|pickup|delivery|have_artwork|need_design|skip)$/i.test(
          rawMsg,
        ));

    // 8. Explicit new product / order intent (only if not an in-progress workflow answer)
    if (!isWorkflowAnswer) {
      const product = await this.productRouter.classify(state);
      if (product) {
        return product;
      }
    }

    // 9. Active workflow preservation
    if (hasActiveWorkflow) {
      const activeCapability = state.workflow === "LEAD" ? "lead" : "sales";
      console.log(
        `[RoutingEngine] Active workflow preserved: workflow=${state.workflow} currentStep=${state.currentStep} -> capability=${activeCapability}`,
      );
      return {
        capability: activeCapability,
        capabilities: [activeCapability],
        confidence: 1,
        source: "WORKFLOW",
        workflow: state.workflow,
        step: state.currentStep,
      };
    }

    // 9. Greeting (when no active workflow)
    const greeting = this.greeting.classify(state);
    if (greeting) {
      return greeting;
    }

    // 10. Intent router / fallback
    return await this.intentRouter.classify(state);
  }

  routeAction(action) {
    if (!action?.id) {
      return null;
    }

    const actionId = action.id;

    // Product details actions
    if (PRODUCT_DETAILS_ACTIONS.has(actionId)) {
      return {
        capability: "product_details",
        capabilities: ["product_details"],
        confidence: 1,
        source: "ACTION",
      };
    }

    // Human handoff actions
    if (actionId === "HUMAN_HANDOFF" || actionId === "TALK_TO_EXPERT") {
      return {
        capability: "lead",
        capabilities: ["lead"],
        confidence: 1,
        source: "ACTION",
        requestType: "CONTACT_SALES",
        workflow: "LEAD",
        step: "COLLECT_CUSTOMER",
        action,
      };
    }

    // Sales / Order actions
    if (SALES_ACTIONS.has(actionId)) {
      return {
        capability: "sales",
        capabilities: ["sales"],
        confidence: 1,
        source: "ACTION",
        workflow: "SALES",
        step: actionId === "SUBMIT_ORDER_FORM" ? "ORDER_FORM" : null,
        action,
      };
    }

    // Lead / Quotation actions
    if (actionId === "REQUEST_QUOTE" || actionId === "GET_QUOTE") {
      return {
        capability: "lead",
        capabilities: ["lead"],
        requestType: "QUOTATION",
        confidence: 1,
        source: "ACTION",
        workflow: "LEAD",
        step: "COLLECT_CUSTOMER",
        action,
      };
    }

    if (actionId === "CONTACT_SALES") {
      return {
        capability: "lead",
        capabilities: ["lead"],
        requestType: "CONTACT_SALES",
        confidence: 1,
        source: "ACTION",
        workflow: "LEAD",
        step: "COLLECT_CUSTOMER",
        action,
      };
    }

    if (actionId === "SUBMIT_LEAD") {
      return {
        capability: "lead",
        capabilities: ["lead"],
        requestType: "ORDER",
        confidence: 1,
        source: "ACTION",
        workflow: "LEAD",
        step: "COLLECT_CUSTOMER",
        action,
      };
    }

    // Workflow actions
    if (actionId === "RESUME_WORKFLOW") {
      return {
        capability: "resume_workflow",
        capabilities: ["resume_workflow"],
        confidence: 1,
        source: "ACTION",
        action,
      };
    }

    if (actionId === "CANCEL_WORKFLOW") {
      return {
        capability: "cancel_workflow",
        capabilities: ["cancel_workflow"],
        confidence: 1,
        source: "ACTION",
        action,
      };
    }

    return null;
  }

  normalizeAction(action = null, state = {}) {
    if (!action) {
      return null;
    }

    if (typeof action === "object" && action.id) {
      const payload = action.payload ?? {};

      return {
        ...action,
        id: action.id,
        payload: {
          ...payload,
          formId:
            payload.formId ??
            action.formId ??
            state.formId ??
            state.form?.id ??
            null,
          values:
            payload.values ??
            payload.form ??
            payload.data ??
            action.values ??
            state.values ??
            state.formValues ??
            {},
        },
      };
    }

    if (typeof action === "string") {
      return {
        id: action,
        label: null,
        payload: {
          formId: state.formId ?? state.form?.id ?? null,
          values: state.values ?? state.formValues ?? {},
        },
      };
    }

    return null;
  }
}
