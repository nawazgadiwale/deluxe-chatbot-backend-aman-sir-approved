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
     * ORDER CONFIRMATION -> CONVERSATIONAL LEAD COLLECTION
     * ============================================================
     *
     * Customer details are collected only after explicit
     * CONFIRM_ORDER.
     *
     * No customer form.
     * No WhatsApp Flow.
     * WhatsApp number comes from the inbound channel.
     */

    if (action?.id === "CONFIRM_ORDER") {
      console.log("");
      console.log("========== ORDER CONFIRMED ==========");
      console.log("========== SALES -> LEAD AGENT ==========");

      const order =
        state.order ??
        state.orderContext ??
        state.liveRequirement ??
        state.productSales ??
        null;

      if (!order) {
        const message =
          "I couldn't find the current order. Please start the order again.";

        return {
          ...state,
          action: null,
          workflow: "SALES",
          currentStep: null,
          nextStep: null,
          awaitingDecision: false,
          assistantMessage: message,
          response: responseBuilder.build({
            workflow: "SALES",
            interaction: "MESSAGE",
            message,
            actions: [],
            sections: [],
            liveRequirement: null,
            completed: false,
            metadata: {
              stage: "ORDER_ERROR",
            },
            currentStep: null,
            nextStep: null,
          }),
        };
      }

      const nextState = {
        ...state,
        action,

        workflow: "LEAD",
        currentStep: "COLLECT_NAME",
        nextStep: "COLLECT_EMAIL",

        awaitingDecision: true,

        completed: false,
        confirmed: true,
        orderConfirmed: true,
        leadCreated: false,

        order,
        orderContext: order,
        liveRequirement: order,
        productSales: order,

        customer: {
          phone:
            state.whatsapp?.phoneNumber ??
            state.whatsapp?.from ??
            state.phoneNumber ??
            "",
          name: null,
          email: null,
          company: null,
        },

        customerCollection: {
          started: false,
          nameResolved: false,
          emailResolved: false,
          companyResolved: false,
        },

        lead: null,
      };

      this.markPersistenceDirty(nextState);

      return await leadAgent.execute(nextState);
    }

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
     * CANCELLATION = HARD RESET
     * ============================================================
     *
     * IMPORTANT:
     *
     * Cancellation MUST be handled before buildOrder().
     *
     * OrderManager.buildOrder() can clone state.order.
     * Therefore building the order before cancellation would allow
     * the cancelled order/product/media state to survive.
     */

    const isCancellation =
      result?.metadata?.cancelled === true ||
      result?.response?.metadata?.cancelled === true ||
      result?.metadata?.stage === "CANCELLED" ||
      result?.response?.metadata?.stage === "CANCELLED" ||
      action?.id === "CANCEL_ORDER";

    if (isCancellation) {
      console.log(
        "[SalesNode][CANCEL] Order cancellation confirmed. Hard resetting active state.",
      );

      const cancellationMessage =
        result?.message ??
        result?.response?.message ??
        "Sure, your current order has been cancelled. What would you like to print?";

      /*
       * ------------------------------------------------------------
       * CLEAN CANCELLATION METADATA
       * ------------------------------------------------------------
       */

      const cancellationMetadata = {
        stage: "CANCELLED",
        cancelled: true,

        product: null,
        selectedProduct: null,
        selection: null,
        productId: null,
        selectionId: null,

        options: [],
        recommendation: null,

        recommendations: {
          relatedProducts: [],
          frequentlyBoughtTogether: [],
          similarProducts: [],
        },

        media: null,
        image: null,
        images: [],
        attachments: [],
      };

      /*
       * ------------------------------------------------------------
       * CLEAN CANCELLATION RESPONSE
       * ------------------------------------------------------------
       */

      const response =
        result?.response ??
        responseBuilder.build({
          workflow: "NONE",
          interaction: "MESSAGE",
          message: cancellationMessage,
          actions: [],
          sections: [],
          context: null,
          liveRequirement: null,
          completed: false,
          metadata: cancellationMetadata,
          currentStep: null,
          nextStep: null,
        });

      /*
       * ------------------------------------------------------------
       * HARD RESET STATE
       * ------------------------------------------------------------
       */

      const nextState = {
        ...state,

        /*
         * ----------------------------------------------------------
         * INPUT / ACTION
         * ----------------------------------------------------------
         */

        action: null,
        message: null,
        userMessage: null,

        /*
         * ----------------------------------------------------------
         * CONVERSATION
         * ----------------------------------------------------------
         */

        workflow: "NONE",
        currentStep: null,
        nextStep: null,
        awaitingDecision: false,

        /*
         * ----------------------------------------------------------
         * COMPLETION / CONFIRMATION
         * ----------------------------------------------------------
         */

        completed: false,
        confirmed: false,
        orderConfirmed: false,
        leadCreated: false,

        /*
         * ----------------------------------------------------------
         * ACTIVE REQUIREMENT / ORDER
         * ----------------------------------------------------------
         */

        liveRequirement: null,
        productSales: null,
        orderContext: null,
        order: null,

        /*
         * ----------------------------------------------------------
         * CUSTOMER / LEAD
         * ----------------------------------------------------------
         *
         * These belong to the previous active order/conversation.
         * Clear them so the next order starts clean.
         */

        customer: null,
        lead: null,
        customerCollection: null,

        /*
         * ----------------------------------------------------------
         * PRODUCT
         * ----------------------------------------------------------
         */

        selectedProduct: null,
        selectedProductId: null,

        product: null,
        productId: null,

        selection: null,
        selectionId: null,

        /*
         * ----------------------------------------------------------
         * ORDER DATA
         * ----------------------------------------------------------
         */

        fields: null,
        requirements: null,
        addons: null,
        delivery: null,
        review: null,

        /*
         * ----------------------------------------------------------
         * DISCOVERY
         * ----------------------------------------------------------
         */

        discoveryMatches: [],
        browseCatalog: false,

        /*
         * ----------------------------------------------------------
         * MEDIA
         * ----------------------------------------------------------
         */

        attachments: [],
        mediaContext: null,

        /*
         * ----------------------------------------------------------
         * WORKFLOW EXECUTION
         * ----------------------------------------------------------
         */

        workflowStack: [],
        executionPlan: [],
        currentExecutionIndex: 0,

        /*
         * ----------------------------------------------------------
         * SALES RESULT / RESPONSE
         * ----------------------------------------------------------
         */

        sales: result,
        response,

        assistantMessage: cancellationMessage,

        /*
         * ----------------------------------------------------------
         * EXPLICIT CLEAN METADATA
         * ----------------------------------------------------------
         *
         * This is important because downstream code may inspect
         * state.metadata rather than response.metadata.
         */

        metadata: cancellationMetadata,

        /*
         * ----------------------------------------------------------
         * INCOMING MEDIA
         * ----------------------------------------------------------
         *
         * Preserve identity/session information but remove all
         * media belonging to the cancelled order.
         */

        incoming: {
          ...(state.incoming ?? {}),
          attachments: [],
          media: null,
          mediaContext: null,
        },

        /*
         * ----------------------------------------------------------
         * WHATSAPP MEDIA
         * ----------------------------------------------------------
         */

        whatsapp: {
          ...(state.whatsapp ?? {}),
          attachments: [],
          media: null,
          mediaContext: null,
        },

        /*
         * ----------------------------------------------------------
         * PERSISTENCE
         * ----------------------------------------------------------
         */

        persistence: {
          ...(state.persistence ?? {}),

          conversation: {
            ...(state.persistence?.conversation ?? {}),
            dirty: true,
            updatedAt: new Date(),
          },

          order: {
            ...(state.persistence?.order ?? {}),
            dirty: true,
            updatedAt: new Date(),
          },
        },
      };

      this.markPersistenceDirty(nextState);

      console.log("[SalesNode][CANCEL] Active order state cleared.");
      console.log("[SalesNode][CANCEL] Product state cleared.");
      console.log("[SalesNode][CANCEL] Selection state cleared.");
      console.log("[SalesNode][CANCEL] Discovery state cleared.");
      console.log("[SalesNode][CANCEL] Media state cleared.");
      console.log("[SalesNode][CANCEL] Returning clean conversation state.");

      return nextState;
    }

    /*
     * ============================================================
     * BUILD RUNTIME ORDER
     * ============================================================
     *
     * Cancellation has already returned above.
     *
     * Therefore this can safely use the existing order for normal
     * sales processing.
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
     * ORDER COMPLETED (Customer Collection Finalization)
     * ============================================================
     *
     * SalesBrain returns currentStep="ORDER_COMPLETED" after
     * customer collection + lead creation.
     *
     * This MUST be handled before the generic sales state to
     * preserve completed/confirmed/lead fields that SalesValidator
     * strips.
     */

    if (
      result.currentStep === "ORDER_COMPLETED" &&
      result.completed === true
    ) {
      console.log("");
      console.log("========== ORDER COMPLETED ==========");

      const resolvedCustomer =
        result.liveRequirement?.customer ??
        order?.customer ??
        state.customer ??
        null;

      const resolvedLead =
        result.context?.lead ??
        state.lead ??
        null;

      const completedOrder = {
        ...(typeof order?.toObject === "function"
          ? order.toObject()
          : order),

        ...(result.liveRequirement
          ? {
            confirmed:
              result.liveRequirement.confirmed ?? true,

            completed: true,

            status:
              result.liveRequirement.status ?? "CONFIRMED",

            customer: resolvedCustomer,

            leadId:
              result.liveRequirement.leadId ??
              resolvedLead?._id ??
              null,

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

        liveRequirement:
          result.liveRequirement ?? completedOrder,

        productSales:
          result.liveRequirement ?? completedOrder,

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

    const itemObj =
      (result.liveRequirement ?? order)?.items?.[0] ?? {};

    const selId =
      itemObj.selection?.id ??
      itemObj.selectedProduct?.id ??
      null;

    const prodId =
      itemObj.product?.id ??
      itemObj.selectedProduct?.parentProductId ??
      null;

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
          : result.response?.message ?? ""),

      liveRequirement:
        result.liveRequirement ?? order,

      productSales:
        result.liveRequirement ?? order,

      sales: result,

      customer: resolvedCustomer,

      lead:
        result.lead ??
        result.context?.lead ??
        state.lead ??
        null,

      metadata,

      response,

      workflow:
        result.workflow ?? "SALES",

      currentStep:
        result.currentStep ?? null,

      nextStep:
        result.nextStep ?? null,

      awaitingDecision:
        result.awaitingDecision ?? true,

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
     * The order configuration is complete.
     *
     * IMPORTANT:
     * Customer collection does NOT start here.
     *
     * The user must explicitly confirm the completed order.
     * CONFIRM_ORDER then starts LeadAgent.
     */

    console.log("");
    console.log("========== ORDER FORM COMPLETED ==========");
    console.log("========== WAITING FOR CONFIRM_ORDER ==========");

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
        "Your order details are ready. Please confirm the order to continue.",

      liveRequirement: order,
      productSales: order,
      sales: result,

      response:
        result.response ??
        responseBuilder.build({
          workflow: "SALES",
          interaction:
            Array.isArray(result.actions) &&
              result.actions.length > 0
              ? "BUTTONS"
              : "MESSAGE",
          message:
            result.message ??
            "Your order details are ready. Please confirm the order to continue.",
          actions:
            Array.isArray(result.actions)
              ? result.actions
              : [],
          sections:
            Array.isArray(result.sections)
              ? result.sections
              : [],
          liveRequirement: order,
          completed: false,
          metadata: {
            ...(result.metadata ?? {}),
            stage: "ORDER_REVIEW",
            source: "ORDER_FORM",
          },
          currentStep:
            result.currentStep ??
            "CONFIRM_ORDER",
          nextStep: "CONFIRM_ORDER",
          context: result.context ?? null,
        }),

      workflow: "SALES",
      currentStep:
        result.currentStep ??
        "CONFIRM_ORDER",
      nextStep: "CONFIRM_ORDER",
      awaitingDecision: true,

      order,
      orderContext: order,
    };

    this.markPersistenceDirty(nextState);

    return nextState;
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
    /*
     * No action
     */
    if (!action) {
      return null;
    }

    /*
     * ============================================================
     * OBJECT ACTION
     * ============================================================
     *
     * Canonical:
     *
     * {
     *   id: "SUBMIT_ORDER_FORM",
     *   payload: {
     *     formId: "...",
     *     values: {}
     *   }
     * }
     */

    if (
      typeof action === "object" &&
      action.id
    ) {
      const payload =
        action.payload ?? {};

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
     * Supports APIs that send:
     *
     * action: "SUBMIT_ORDER_FORM"
     */

    if (
      typeof action === "string"
    ) {
      return {
        id: action,

        label: null,

        payload: {
          formId:
            state.formId ??
            state.form?.id ??
            null,

          values:
            state.values ??
            state.formValues ??
            {},
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
