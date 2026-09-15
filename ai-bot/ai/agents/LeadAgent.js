import BaseAgent from "./BaseAgent.js";
import SalesResponseBuilder from "../../modules/sales/builders/SalesResponseBuilder.js";

import LeadEngine from "../../modules/lead/LeadEngine.js";
import LeadConstants from "../../modules/lead/helpers/LeadConstants.js";
import SalesHandoffService from "../../modules/sales/services/SalesHandoffService.js";

const responseBuilder = new SalesResponseBuilder();
const leadEngine = new LeadEngine();
const salesHandoffService = new SalesHandoffService();

const SKIP_VALUES = new Set([
  "",
  "skip",
  "no",
  "none",
  "not applicable",
  "na",
  "n/a",
  "no thanks",
  "prefer not",
]);

export default class LeadAgent extends BaseAgent {
  async execute(state = {}) {
    console.log("========== LEAD AGENT ==========");

    const requestType =
      state.conversation?.requestType ??
      state.persistence?.conversation?.requestType ??
      state.leadContext?.requestType ??
      state.requestType ??
      this.inferRequestType(state);

    state.requestType = requestType;

    state.leadContext = {
      ...(state.leadContext ?? {}),
      requestType,
    };

    this.attachCurrentOrder(state);
    this.attachWhatsAppNumber(state);

    const collection = state.customerCollection ?? {};
    const step = state.currentStep ?? "COLLECT_NAME";

    /*
     * ==========================================================
     * NAME
     * ==========================================================
     */

    if (!collection.nameResolved) {
      /*
       * First entry after CONFIRM_ORDER.
       *
       * Do NOT treat "confirm" as the customer's name.
       */
      if (!collection.started) {
        state.customerCollection = {
          ...collection,
          started: true,
          nameResolved: false,
          emailResolved: false,
          companyResolved: false,
        };

        return this.ask(
          state,
          "COLLECT_NAME",
          "Sure. May I know your full name?",
        );
      }

      const message = this.getUserMessage(state);

      if (!message) {
        return this.ask(
          state,
          "COLLECT_NAME",
          "May I know your full name?",
        );
      }

      if (message.length < 2) {
        return this.ask(
          state,
          "COLLECT_NAME",
          "Please provide your full name.",
        );
      }

      state.customer = {
        ...(state.customer ?? {}),
        name: message,
      };

      state.customerCollection = {
        ...state.customerCollection,
        nameResolved: true,
      };

      return this.ask(
        state,
        "COLLECT_EMAIL",
        "Thanks. What is your email address? You can skip this if you prefer.",
      );
    }

    /*
     * ==========================================================
     * EMAIL
     * ==========================================================
     */

    if (!collection.emailResolved) {
      const message = this.getUserMessage(state);

      if (!message) {
        return this.ask(
          state,
          "COLLECT_EMAIL",
          "What is your email address? You can skip this if you prefer.",
        );
      }

      if (this.isSkip(message)) {
        state.customer = {
          ...(state.customer ?? {}),
          email: null,
        };
      } else {
        const email = message.trim();

        if (!this.isValidEmail(email)) {
          return this.ask(
            state,
            "COLLECT_EMAIL",
            "That doesn't look like a valid email address. Please enter a valid email or type 'skip'.",
          );
        }

        state.customer = {
          ...(state.customer ?? {}),
          email,
        };
      }

      state.customerCollection = {
        ...state.customerCollection,
        emailResolved: true,
      };

      return this.ask(
        state,
        "COLLECT_COMPANY",
        "What is your company name? You can skip this if you prefer.",
      );
    }

    /*
     * ==========================================================
     * COMPANY
     * ==========================================================
     */

    if (!collection.companyResolved) {
      const message = this.getUserMessage(state);

      if (!message) {
        return this.ask(
          state,
          "COLLECT_COMPANY",
          "What is your company name? You can skip this if you prefer.",
        );
      }

      state.customer = {
        ...(state.customer ?? {}),
        company: this.isSkip(message)
          ? null
          : message.trim(),
      };

      state.customerCollection = {
        ...state.customerCollection,
        companyResolved: true,
      };
    }

    /*
     * ==========================================================
     * CREATE LEAD
     * ==========================================================
     */

    state.currentStep = "CREATE_LEAD";

    const result = await leadEngine.execute(state);

    if (!result?.completed) {
      return this.ask(
        state,
        result?.nextStep ?? "COLLECT_NAME",
        result?.message ?? "Please provide your details.",
      );
    }

    /*
     * ==========================================================
     * SAVE RESULT TO STATE
     * ==========================================================
     */

    state.lead = result.lead ?? null;

    if (result.order?._id) {
      state.order = result.order;
      state.orderContext = result.order;
      state.liveRequirement = result.order;
      state.productSales = result.order;
    }

    state.customer = {
      name:
        result.lead?.name ??
        state.customer?.name ??
        "",

      phone:
        result.lead?.phoneNumber ??
        state.customer?.phone ??
        "",

      email:
        result.lead?.emailId ??
        null,

      company:
        result.lead?.companyName ??
        null,
    };

    state.workflow = "LEAD";
    state.currentStep = "LEAD_COMPLETED";
    state.nextStep = null;
    state.awaitingDecision = false;
    state.completed = true;
    state.leadSubmission = true;

    state.assistantMessage =
      result.message ??
      "Thank you. Your details have been received successfully.";

    state.response = responseBuilder.build({
      workflow: "LEAD",
      interaction: "MESSAGE",
      message:
        result.message ??
        "Thank you. Your details have been received successfully.",
      actions: [],
      sections: [],
      liveRequirement:
        state.order ??
        state.orderContext ??
        state.liveRequirement ??
        null,
      completed: true,
      metadata: {
        stage: "LEAD_COMPLETED",
        status: "COMPLETED",
        lead: result.lead,
        order: result.order,
      },
      currentStep: "LEAD_COMPLETED",
      nextStep: null,
      context: {
        stage: "LEAD_COMPLETED",
        step: "LEAD_COMPLETED",
        lead: result.lead,
        order: result.order,
      },
    });

    if (state.persistence) {
      state.persistence.lead = {
        ...(state.persistence.lead ?? {}),
        dirty: true,
        submitted: true,
        submittedAt: new Date(),
        leadId:
          result.lead?._id ??
          result.lead?.id ??
          result.lead?.leadId ??
          null,
      };

      if (state.persistence.order) {
        state.persistence.order.dirty = true;
        state.persistence.order.updatedAt = new Date();
      }

      if (state.persistence.conversation) {
        state.persistence.conversation.dirty = true;
        state.persistence.conversation.updatedAt = new Date();
      }
    }

    try {
      await salesHandoffService.triggerHandoff(state, "SALES_HANDOFF");
    } catch (err) {
      console.warn("[LeadAgent] Sales handoff notification skipped:", err.message);
    }

    return state;
  }

  /*
   * ==========================================================
   * ASK CUSTOMER
   * ==========================================================
   */

  ask(state, step, message) {
    state.workflow = "LEAD";
    state.currentStep = step;

    state.nextStep =
      step === "COLLECT_NAME"
        ? "COLLECT_EMAIL"
        : step === "COLLECT_EMAIL"
          ? "COLLECT_COMPANY"
          : "CREATE_LEAD";

    state.awaitingDecision = true;
    state.completed = false;
    state.assistantMessage = message;

    state.response = responseBuilder.build({
      workflow: "LEAD",
      interaction: "MESSAGE",
      message,
      actions: [],
      sections: [],
      liveRequirement:
        state.order ??
        state.orderContext ??
        state.liveRequirement ??
        null,
      completed: false,
      metadata: {
        stage: "COLLECT_CUSTOMER",
        conversational: true,
        customerCollection: true,
      },
      currentStep: step,
      nextStep: state.nextStep,
      context: {
        stage: "COLLECT_CUSTOMER",
        step,
        customer: {
          name: state.customer?.name ?? null,
          phone: state.customer?.phone ?? null,
          email: state.customer?.email ?? null,
          company: state.customer?.company ?? null,
        },
      },
    });

    return state;
  }

  /*
   * ==========================================================
   * CURRENT ORDER
   * ==========================================================
   */

  attachCurrentOrder(state) {
    const order =
      state.order ??
      state.orderContext ??
      state.liveRequirement ??
      state.productSales ??
      null;

    if (!order) return;

    state.order = order;
    state.orderContext = order;
    state.liveRequirement = order;
    state.productSales = order;
  }

  /*
   * ==========================================================
   * WHATSAPP NUMBER
   * ==========================================================
   */

  attachWhatsAppNumber(state) {
    const phone =
      state.whatsapp?.phoneNumber ??
      state.phoneNumber ??
      state.customer?.phone ??
      "";

    state.customer = {
      ...(state.customer ?? {}),
      phone,
    };
  }

  /*
   * ==========================================================
   * USER MESSAGE
   * ==========================================================
   */

  getUserMessage(state = {}) {
    return String(
      state.userMessage ??
      state.message ??
      state.incoming?.message ??
      state.whatsapp?.text ??
      "",
    ).trim();
  }

  /*
   * ==========================================================
   * OPTIONAL VALUE
   * ==========================================================
   */

  isSkip(value = "") {
    return SKIP_VALUES.has(
      String(value).trim().toLowerCase(),
    );
  }

  /*
   * ==========================================================
   * EMAIL
   * ==========================================================
   */

  isValidEmail(value = "") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /*
   * ==========================================================
   * REQUEST TYPE
   * ==========================================================
   */

  inferRequestType(state = {}) {
    const requirement =
      state.order ??
      state.orderContext ??
      state.liveRequirement ??
      state.productSales ??
      null;

    return Array.isArray(requirement?.items) &&
      requirement.items.length > 0
      ? LeadConstants.REQUEST_TYPES.ORDER
      : LeadConstants.REQUEST_TYPES.EXPERT;
  }
}