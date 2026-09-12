import SalesService from "../../../modules/sales/SalesService.js";
import SalesResponseBuilder from "../../../modules/sales/builders/SalesResponseBuilder.js";
import OrderManager from "../../../modules/sales/services/OrderManager.js";
import LeadAgent from "../../agents/LeadAgent.js";

const salesService = new SalesService();
const responseBuilder = new SalesResponseBuilder();
const orderManager = new OrderManager();
const leadAgent = new LeadAgent();

const FORM_SUBMIT_ACTION = "SUBMIT_ORDER_FORM";

export default class SalesNode {
  async execute(state = {}) {
    console.log("");
    console.log("========================================");
    console.log("========== SALES NODE ==========");
    console.log("========================================");

    console.log("Workflow:", state.workflow);
    console.log("Current Step:", state.currentStep);

    console.log("Raw Action:");
    console.dir(state.action, { depth: null });

    /*
     * ============================================================
     * NORMALIZE ACTION
     * ============================================================
     */

    const action = this.normalizeAction(state.action, state);

    console.log("Normalized Action:");
    console.dir(action, { depth: null });

    /*
     * ============================================================
     * FORM SUBMISSION
     * ============================================================
     *
     * Form submission NEVER goes through conversational logic.
     *
     * The frontend sends:
     *
     * SUBMIT_ORDER_FORM
     *      +
     * formId
     *      +
     * values
     *
     * Then SalesService/SalesBrain validates the catalog form.
     */

    if (action?.id === FORM_SUBMIT_ACTION) {
      console.log("");
      console.log("========== DIRECT FORM SUBMISSION ==========");

      console.log("Form ID:", action.payload?.formId);

      console.log("Form Values:");
      console.dir(action.payload?.values, { depth: null });

      return await this.handleFormSubmission({
        ...state,
        action,
      });
    }

    /*
     * ============================================================
     * CONVERSATIONAL SALES
     * ============================================================
     *
     * ONLY:
     *
     * - product discovery
     * - product recommendation
     * - product selection
     * - variant/selection
     *
     * should reach SalesService conversational processing.
     *
     * Quantity, artwork, delivery, addons etc. belong to the
     * catalog-driven order form.
     */

    const result = await salesService.execute({
      ...state,
      action,
    });

    console.log("");
    console.log("========== SALES RESULT ==========");
    console.dir(result, { depth: null });

    /*
     * ============================================================
     * BUILD RUNTIME ORDER
     * ============================================================
     */

    const order = orderManager.buildOrder(
      result.liveRequirement ?? state.liveRequirement ?? {},
      state.order,
    );

    /*
     * ============================================================
     * SALES RESPONSE
     * ============================================================
     */

    const response =
      result.response ??
      responseBuilder.build({
        workflow: result.workflow ?? "SALES",

        interaction:
          result.interaction ??
          (Array.isArray(result.actions) && result.actions.length > 0
            ? "BUTTONS"
            : "MESSAGE"),

        message: result.message ?? "",

        actions: Array.isArray(result.actions) ? result.actions : [],

        sections: Array.isArray(result.sections) ? result.sections : [],

        liveRequirement: result.liveRequirement ?? order,

        completed: result.completed === true,

        metadata: result.metadata ?? {},

        currentStep: result.currentStep ?? null,

        nextStep: result.nextStep ?? null,

        context: result.context ?? null,
      });

    /*
     * ============================================================
     * SALES -> LEAD
     * ============================================================
     *
     * This should only happen after a successful order-form
     * submission.
     */

    if (result.completed === true && result.workflow === "LEAD") {
      console.log("");
      console.log("========== SALES -> LEAD ==========");

      const nextState = {
        ...state,

        action,

        assistantMessage:
          result.message ??
          "Your order details have been received. Let's get your contact details.",

        liveRequirement: result.liveRequirement ?? order,

        productSales: result.liveRequirement ?? order,

        sales: result,

        response,

        workflow: "LEAD",

        currentStep: "COLLECT_CUSTOMER",

        nextStep: "SUBMIT_LEAD",

        awaitingDecision: true,

        order,

        orderContext: order,
      };

      this.markPersistenceDirty(nextState);

      /*
       * LeadAgent now owns customer information.
       *
       * SalesNode does NOT collect:
       *
       * - name
       * - email
       * - phone
       * - company
       */

      return await leadAgent.execute(nextState);
    }

    /*
     * ============================================================
     * CANCELLATION DETECTED
     * ============================================================
     */

    if (
      result.metadata?.cancelled === true ||
      action?.id === "CANCEL_ORDER" ||
      result.workflow === "NONE"
    ) {
      console.log(
        "[SalesNode] Order cancellation confirmed. Wiping active state.",
      );
      const nextState = {
        ...state,
        action,
        selectedProduct: null,
        assistantMessage:
          result.message ?? "Your order form has been cancelled.",
        liveRequirement: null,
        productSales: null,
        sales: result,
        response,
        workflow: "NONE",
        currentStep: null,
        nextStep: null,
        awaitingDecision: false,
        order: state.order
          ? {
              ...(typeof state.order.toObject === "function"
                ? state.order.toObject()
                : state.order),
              status: "CANCELLED",
              active: false,
            }
          : null,
        orderContext: null,
        workflowStack: [],
        executionPlan: [],
        currentExecutionIndex: 0,
      };

      this.markPersistenceDirty(nextState);
      return nextState;
    }

    /*
     * ============================================================
     * ORDER COMPLETED (Customer Collection Finalization)
     * ============================================================
     *
     * SalesBrain returns currentStep="ORDER_COMPLETED" after
     * customer collection + lead creation.
     *
     * This MUST be handled before the generic sales state
     * to preserve completed/confirmed/lead fields that
     * SalesValidator strips.
     */

    if (result.currentStep === "ORDER_COMPLETED" && result.completed === true) {
      console.log("");
      console.log("========== ORDER COMPLETED ==========");

      const resolvedCustomer =
        result.liveRequirement?.customer ??
        order?.customer ??
        state.customer ??
        null;

      const resolvedLead = result.context?.lead ?? state.lead ?? null;

      const completedOrder = {
        ...(typeof order?.toObject === "function" ? order.toObject() : order),
        ...(result.liveRequirement
          ? {
              confirmed: result.liveRequirement.confirmed ?? true,
              completed: true,
              status: result.liveRequirement.status ?? "CONFIRMED",
              customer: resolvedCustomer,
              leadId:
                result.liveRequirement.leadId ?? resolvedLead?._id ?? null,
              orderNumber:
                result.liveRequirement.orderNumber ??
                order?.orderNumber ??
                null,
            }
          : {}),
      };

      const completedResponse =
        result.response ??
        responseBuilder.build({
          workflow: "SALES",
          interaction: "MESSAGE",
          message:
            result.message ??
            "Thank you! Your order details have been submitted successfully.",
          liveRequirement: completedOrder,
          completed: true,
          metadata: result.metadata ?? {},
          currentStep: "ORDER_COMPLETED",
        });

      const nextState = {
        ...state,

        action,

        assistantMessage: result.message ?? "",

        liveRequirement: result.liveRequirement ?? completedOrder,

        productSales: result.liveRequirement ?? completedOrder,

        sales: result,

        customer: resolvedCustomer,

        lead: resolvedLead,

        metadata: {
          ...(state.metadata ?? {}),
          ...(result.metadata ?? {}),
          routing: {
            ...(state.metadata?.routing ?? {}),
            ...(result.metadata?.routing ?? {}),
            step: "ORDER_COMPLETED",
          },
        },

        response: completedResponse,

        workflow: result.workflow ?? "SALES",

        currentStep: "ORDER_COMPLETED",

        nextStep: null,

        awaitingDecision: false,

        completed: true,

        confirmed: true,

        order: completedOrder,

        orderContext: completedOrder,
      };

      this.markPersistenceDirty(nextState);

      return nextState;
    }

    /*
     * ============================================================
     * NORMAL SALES STATE
     * ============================================================
     */

    const activeProduct =
      order?.items?.[0]?.selectedProduct ??
      result.liveRequirement?.items?.[0]?.selectedProduct ??
      order?.items?.[0]?.product ??
      result.liveRequirement?.items?.[0]?.product ??
      state.selectedProduct ??
      order?.items?.[0]?.selection ??
      null;

    const itemObj = (result.liveRequirement ?? order)?.items?.[0] ?? {};
    const selId = itemObj.selection?.id ?? itemObj.selectedProduct?.id ?? null;
    const prodId =
      itemObj.product?.id ?? itemObj.selectedProduct?.parentProductId ?? null;
    console.log(
      `[WhatsApp][State] productId=${prodId || "none"} selectionId=${selId || "none"} currentField=${result.currentStep || "none"}`,
    );

    const resolvedCustomer =
      result.customer ??
      result.liveRequirement?.customer ??
      order?.customer ??
      state.customer ??
      null;

    const metadata = {
      ...(state.metadata ?? {}),
      ...(result.metadata ?? {}),
      ...(result.currentStep
        ? {
            routing: {
              ...(state.metadata?.routing ?? {}),
              ...(result.metadata?.routing ?? {}),
              step: result.currentStep,
            },
          }
        : {}),
    };

    const nextState = {
      ...state,

      action,

      selectedProduct: activeProduct,

      assistantMessage:
        result.assistantMessage ??
        result.response?.message ??
        (result.message !== state.message &&
        result.message !== state.userMessage
          ? result.message
          : (result.response?.message ?? "")),

      liveRequirement: result.liveRequirement ?? order,

      productSales: result.liveRequirement ?? order,

      sales: result,

      customer: resolvedCustomer,

      lead: result.lead ?? result.context?.lead ?? state.lead ?? null,

      metadata,

      response,

      workflow: result.workflow ?? "SALES",

      currentStep: result.currentStep ?? null,

      nextStep: result.nextStep ?? null,

      awaitingDecision: result.awaitingDecision ?? true,

      order,

      orderContext: order,
    };

    this.markPersistenceDirty(nextState);

    return nextState;
  }

  /*
   * ============================================================
   * FORM SUBMISSION
   * ============================================================
   */

  async handleFormSubmission(state = {}) {
    const action = this.normalizeAction(state.action, state);

    const formId = action?.payload?.formId ?? null;

    const values = action?.payload?.values ?? {};

    console.log("");
    console.log("========================================");
    console.log("========== FORM SUBMISSION ==========");
    console.log("========================================");

    console.log("Form ID:", formId);

    console.log("Values:");
    console.dir(values, { depth: null });

    /*
     * Reject malformed submissions before calling SalesService.
     */

    if (!formId) {
      console.error("SUBMIT_ORDER_FORM missing formId");

      return this.buildFormErrorState(
        state,
        action,
        "The order form identifier is missing. Please reopen the order form and try again.",
      );
    }

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      console.error("SUBMIT_ORDER_FORM missing values");

      return this.buildFormErrorState(
        state,
        action,
        "No order form values were received. Please complete the form and try again.",
      );
    }

    /*
     * ============================================================
     * SALES SERVICE
     * ============================================================
     *
     * SalesService receives structured catalog data.
     *
     * NO LLM conversation is needed here.
     */

    const result = await salesService.execute({
      ...state,

      action: {
        id: FORM_SUBMIT_ACTION,

        label: null,

        payload: {
          formId,

          values,
        },
      },
    });

    console.log("");
    console.log("========== FORM RESULT ==========");
    console.dir(result, { depth: null });

    /*
     * ============================================================
     * BUILD ORDER
     * ============================================================
     */

    const order =
      result.liveRequirement ??
      orderManager.buildOrder(state.liveRequirement ?? {}, state.order);

    /*
     * ============================================================
     * FORM VALIDATION FAILED
     * ============================================================
     */

    if (result.completed !== true || result.workflow !== "LEAD") {
      console.log(
        "========== FORM VALIDATION FAILED / FORM CONTINUES ==========",
      );

      const response =
        result.response ??
        responseBuilder.build({
          workflow: "SALES",

          interaction: "FORM",

          message:
            result.message ?? "Please complete the required order details.",

          actions: Array.isArray(result.actions)
            ? result.actions
            : [
                {
                  id: FORM_SUBMIT_ACTION,

                  label: "Continue",

                  payload: {
                    formId,
                  },
                },
              ],

          sections: Array.isArray(result.sections) ? result.sections : [],

          liveRequirement: order,

          completed: false,

          metadata: {
            ...(result.metadata ?? {}),

            stage: "ORDER_FORM",

            catalogDriven: true,

            formId,
          },

          currentStep: "ORDER_FORM",

          nextStep: FORM_SUBMIT_ACTION,

          context: {
            stage: "ORDER_FORM",

            formId,

            form: result.form ?? result.context?.form ?? null,
          },
        });

      const activeProduct =
        order?.items?.[0]?.selectedProduct ??
        result.liveRequirement?.items?.[0]?.selectedProduct ??
        order?.items?.[0]?.product ??
        result.liveRequirement?.items?.[0]?.product ??
        state.selectedProduct ??
        order?.items?.[0]?.selection ??
        null;

      const nextState = {
        ...state,

        action,

        selectedProduct: activeProduct,

        assistantMessage: result.message ?? "",

        liveRequirement: order,

        productSales: order,

        sales: result,

        response,

        workflow: "SALES",

        currentStep: "ORDER_FORM",

        nextStep: FORM_SUBMIT_ACTION,

        awaitingDecision: true,

        order,

        orderContext: order,
      };

      this.markPersistenceDirty(nextState);

      return nextState;
    }

    /*
     * ============================================================
     * ORDER FORM SUCCESS
     * ============================================================
     *
     * IMPORTANT:
     *
     * The order form is now complete.
     *
     * Customer information is NOT collected here.
     *
     * LeadAgent takes over.
     */

    console.log("");
    console.log("========== ORDER FORM COMPLETED ==========");
    console.log("========== SALES -> LEAD AGENT ==========");

    const activeProduct =
      order?.items?.[0]?.selectedProduct ??
      order?.items?.[0]?.selection ??
      order?.items?.[0]?.product ??
      result.liveRequirement?.items?.[0]?.selectedProduct ??
      result.liveRequirement?.items?.[0]?.selection ??
      result.liveRequirement?.items?.[0]?.product ??
      state.selectedProduct ??
      null;

    const nextState = {
      ...state,

      action,

      selectedProduct: activeProduct,

      assistantMessage:
        result.message ??
        "Your order details have been received. Let's get your contact details so our sales team can prepare your quotation.",

      liveRequirement: order,

      productSales: order,

      sales: result,

      response:
        result.response ??
        responseBuilder.build({
          workflow: "LEAD",

          interaction: "MESSAGE",

          message:
            "Your order details have been received. Let's get your contact details so our sales team can prepare your quotation.",

          actions: [],

          sections: [],

          liveRequirement: order,

          completed: true,

          metadata: {
            ...(result.metadata ?? {}),

            stage: "COLLECT_CUSTOMER",

            source: "ORDER_FORM",

            leadType: "ORDER_REQUEST",

            formId,
          },

          currentStep: "COLLECT_CUSTOMER",

          nextStep: "SUBMIT_LEAD",

          context: {
            stage: "COLLECT_CUSTOMER",

            order,
          },
        }),

      workflow: "LEAD",

      currentStep: "COLLECT_CUSTOMER",

      nextStep: "SUBMIT_LEAD",

      awaitingDecision: true,

      order,

      orderContext: order,
    };

    this.markPersistenceDirty(nextState);

    return await leadAgent.execute(nextState);
  }

  /*
   * ============================================================
   * FORM ERROR
   * ============================================================
   */

  buildFormErrorState(state, action, message) {
    const response = responseBuilder.build({
      workflow: "SALES",

      interaction: "FORM",

      message,

      actions: [
        {
          id: FORM_SUBMIT_ACTION,

          label: "Continue",

          payload: {
            formId: action?.payload?.formId ?? null,
          },
        },
      ],

      sections: [],

      liveRequirement: state.liveRequirement ?? {},

      completed: false,

      metadata: {
        stage: "ORDER_FORM",

        catalogDriven: true,
      },

      currentStep: "ORDER_FORM",

      nextStep: FORM_SUBMIT_ACTION,

      context: {
        stage: "ORDER_FORM",

        formId: action?.payload?.formId ?? null,
      },
    });

    const nextState = {
      ...state,

      action,

      assistantMessage: message,

      response,

      workflow: "SALES",

      currentStep: "ORDER_FORM",

      nextStep: FORM_SUBMIT_ACTION,

      awaitingDecision: true,
    };

    this.markPersistenceDirty(nextState);

    return nextState;
  }

  /*
   * ============================================================
   * ACTION NORMALIZATION
   * ============================================================
   *
   * Canonical action:
   *
   * {
   *   id: "SUBMIT_ORDER_FORM",
   *   payload: {
   *     formId: "order-form-1",
   *     values: {}
   *   }
   * }
   *
   * This method also supports the API sending formId/values
   * beside the action.
   */

  normalizeAction(action = null, state = {}) {
    if (!action) {
      return null;
    }

    /*
     * ============================================================
     * OBJECT ACTION
     * ============================================================
     */

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

    /*
     * ============================================================
     * STRING ACTION
     * ============================================================
     *
     * This is supported ONLY if the API already copied
     * formId/values into graph state.
     */

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

  /*
   * ============================================================
   * PERSISTENCE
   * ============================================================
   */

  markPersistenceDirty(state = {}) {
    if (!state.persistence) {
      return;
    }

    if (state.persistence.conversation) {
      state.persistence.conversation.dirty = true;

      state.persistence.conversation.updatedAt = new Date();
    }

    if (state.persistence.order) {
      state.persistence.order.dirty = true;

      state.persistence.order.updatedAt = new Date();
    }
  }
}
