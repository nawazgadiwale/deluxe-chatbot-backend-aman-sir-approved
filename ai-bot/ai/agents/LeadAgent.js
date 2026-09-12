import BaseAgent from "./BaseAgent.js";

import ResponseBuilder from "../../core/responses/Apiresponse.js";

import LeadEngine from "../../modules/lead/LeadEngine.js";

import LeadConstants from "../../modules/lead/helpers/LeadConstants.js";
import ReviewBuilder from "../../modules/sales/builders/ReviewBuilder.js";

const responseBuilder = new ResponseBuilder();
const leadEngine = new LeadEngine();
const reviewBuilder = new ReviewBuilder();

const SUBMIT_LEAD = LeadConstants?.ACTIONS?.SUBMIT_LEAD ?? "SUBMIT_LEAD";

export default class LeadAgent extends BaseAgent {
  async execute(state = {}) {
    console.log("========== LEAD AGENT ==========");

    // ==========================================================
    // 1. NORMALIZE REQUEST TYPE
    // ==========================================================

    const requestType =
      state.conversation?.requestType ??
      state.persistence?.conversation?.requestType ??
      state.leadContext?.requestType ??
      state.requestType ??
      state.routing?.requestType ??
      this.inferRequestType(state);

    state.requestType = requestType;

    state.leadContext = {
      ...(state.leadContext ?? {}),
      requestType,
    };

    // ==========================================================
    // 2. DETECT LEAD SUBMISSION
    // ==========================================================

    const isLeadSubmission =
      state.action?.id === SUBMIT_LEAD ||
      state.currentStep === "SUBMIT_LEAD";

    console.log("[LeadAgent] requestType:", requestType);
    console.log("[LeadAgent] isLeadSubmission:", isLeadSubmission);

    // ==========================================================
    // 3. NORMALIZE LEAD FORM DATA
    // ==========================================================

    if (isLeadSubmission) {
      const flowResponse = this.extractFlowResponse(state);

      console.log("========== NORMALIZED LEAD FORM ==========");
      console.dir(flowResponse, {
        depth: null,
      });

      state.whatsapp = {
        ...(state.whatsapp ?? {}),
        messageType: state.whatsapp?.messageType ?? "interactive",
      };

      state.action = {
        ...(state.action ?? {}),
        id: SUBMIT_LEAD,
        payload: {
          ...(state.action?.payload ?? {}),
          values: flowResponse,
          fields: flowResponse,
        },
      };
    }

    // ==========================================================
    // 4. PRESERVE SALES REQUIREMENT
    // ==========================================================
    //
    // IMPORTANT:
    //
    // Customer form must NEVER replace the order.
    //
    // The completed Sales requirement is the source of:
    //
    //   product
    //   selection
    //   quantity
    //   artwork
    //   delivery
    //   pricing
    //   order details
    //
    // Lead only adds customer information.
    // ==========================================================

    const existingRequirement =
      state.liveRequirement ??
      state.order ??
      state.orderContext ??
      state.productSales ??
      null;

    if (existingRequirement) {
      state.liveRequirement = existingRequirement;

      state.order = state.order ?? existingRequirement;

      state.orderContext = state.orderContext ?? existingRequirement;

      state.productSales = state.productSales ?? existingRequirement;
    }

    // ==========================================================
    // 5. EXECUTE LEAD ENGINE
    // ==========================================================

    const result = await leadEngine.execute(state);

    console.log("========== LEAD ENGINE RESULT ==========");
    console.dir(result, {
      depth: null,
    });

    // ==========================================================
    // 6. LEAD FORM STILL REQUIRED
    // ==========================================================

    if (!result?.completed) {
      state.workflow = "LEAD";

      state.currentStep = "COLLECT_CUSTOMER";

      state.awaitingDecision = true;

      state.completed = false;

      const resolvedRequestType =
        state.conversation?.requestType ??
        state.persistence?.conversation?.requestType ??
        state.leadContext?.requestType ??
        state.requestType ??
        requestType;

      state.requestType = resolvedRequestType;

      state.leadContext = {
        ...(state.leadContext ?? {}),
        requestType: resolvedRequestType,
      };

      state.response = responseBuilder.lead({
        status: result?.status ?? "PENDING",

        response: result?.form ?? result?.response ?? null,

        form: result?.form ?? null,
      });

      return state;
    }

    // ==========================================================
    // 7. CREATED LEAD
    // ==========================================================

    state.lead = result.lead ?? null;

    // ==========================================================
    // 7.5 ORDER REVIEW GATE
    // ==========================================================
    // A lead can be created from the customer form, but the order is
    // still only a draft. Final order confirmation happens separately.
    const reviewOrder =
      result.order ?? state.order ?? state.orderContext ?? state.liveRequirement ?? null;

    if (
      requestType === LeadConstants.REQUEST_TYPES.ORDER &&
      Array.isArray(reviewOrder?.items) &&
      reviewOrder.items.length > 0 &&
      reviewOrder.confirmed !== true &&
      reviewOrder.status !== "CONFIRMED"
    ) {
      state.order = reviewOrder;
      state.orderContext = reviewOrder;
      state.liveRequirement = reviewOrder;

      if (result.lead) {
        state.customer = {
          ...(state.customer ?? {}),
          name: result.lead.name ?? state.customer?.name ?? "",
          phone: result.lead.phoneNumber ?? state.whatsapp?.phoneNumber ?? state.customer?.phone ?? "",
          email: result.lead.emailId ?? state.customer?.email ?? "",
          company: result.lead.companyName ?? state.customer?.company ?? "",
        };
      }

      const review = reviewBuilder.build(
        reviewOrder,
        reviewOrder.pricing ?? {},
        reviewOrder.delivery ?? {},
      );

      const message = this.buildReviewMessage(reviewOrder, state.customer);

      state.workflow = "SALES";
      state.currentStep = "ORDER_REVIEW";
      state.nextStep = "CONFIRM_ORDER";
      state.awaitingDecision = true;
      state.completed = false;
      state.orderReview = review;
      state.assistantMessage = message;
      state.response = responseBuilder.build({
        workflow: "SALES",
        completed: false,
        interaction: "BUTTONS",
        liveRequirement: reviewOrder,
        message,
        actions: [
          { id: "CONFIRM_ORDER", label: "Confirm", payload: {} },
          { id: "EDIT_ORDER", label: "Edit", payload: {} },
          { id: "HUMAN_HANDOFF", label: "Talk to Expert", payload: {} },
        ],
        sections: review.sections ?? [],
        metadata: { stage: "ORDER_REVIEW", leadCreated: Boolean(result.lead), orderConfirmed: false },
        currentStep: "ORDER_REVIEW",
        nextStep: "CONFIRM_ORDER",
        context: { action: "ORDER_REVIEW", review, order: reviewOrder },
      });
      state.persistence = {
        ...(state.persistence ?? {}),
        conversation: { ...(state.persistence?.conversation ?? {}), dirty: true, updatedAt: new Date() },
        order: { ...(state.persistence?.order ?? {}), dirty: true, updatedAt: new Date() },
        lead: { ...(state.persistence?.lead ?? {}), dirty: true, submitted: Boolean(result.lead), updatedAt: new Date() },
      };
      return state;
    }

    // ==========================================================
    // 8. UPDATED ORDER
    // ==========================================================

    if (result.order) {
      state.order = result.order;

      state.orderContext = result.order;

      state.liveRequirement = result.order;

      state.productSales = {
        ...(state.productSales ?? {}),
        ...result.order,
      };
    }

    // ==========================================================
    // 9. CUSTOMER
    // ==========================================================

    if (result.lead) {
      state.customer = {
        ...(state.customer ?? {}),

        name: result.lead.name ?? result.lead.fullName ?? "",

        phone:
          result.lead.phoneNumber ??
          result.lead.phone ??
          state.whatsapp?.phoneNumber ??
          "",

        email: result.lead.emailId ?? result.lead.email ?? "",

        company: result.lead.companyName ?? result.lead.company ?? "",
      };
    }

    // ==========================================================
    // 10. WORKFLOW COMPLETE
    // ==========================================================

    state.workflow = "LEAD";

    state.currentStep = "LEAD_COMPLETED";

    state.nextStep = null;

    state.awaitingDecision = false;

    state.completed = true;

    state.leadSubmission = true;

    // ==========================================================
    // 11. REQUEST TYPE
    // ==========================================================

    const finalRequestType =
      state.conversation?.requestType ??
      state.persistence?.conversation?.requestType ??
      state.leadContext?.requestType ??
      state.requestType ??
      requestType;

    state.requestType = finalRequestType;

    state.leadContext = {
      ...(state.leadContext ?? {}),
      requestType: finalRequestType,

      stage: "LEAD_COMPLETED",
    };

    // ==========================================================
    // 12. PERSISTENCE
    // ==========================================================

    if (state.persistence) {
      if (state.persistence.customer) {
        state.persistence.customer.dirty = true;
        state.persistence.customer.updatedAt = new Date();
      }

      if (state.persistence.conversation) {
        state.persistence.conversation.dirty = true;
        state.persistence.conversation.updatedAt = new Date();
      }

      if (state.persistence.order) {
        state.persistence.order.dirty = true;
        state.persistence.order.updatedAt = new Date();
      }

      state.persistence.lead = {
        ...(state.persistence.lead ?? {}),

        dirty: true,

        submitted: true,

        submittedAt: new Date(),

        leadId: result.lead?.id ?? result.lead?.leadId ?? null,
      };
    }

    // ==========================================================
    // 13. SUCCESS MESSAGE
    // ==========================================================

    let title = "Request Submitted Successfully";

    let message = "Thank you! Our sales team will contact you shortly.";

    if (finalRequestType === LeadConstants.REQUEST_TYPES.ORDER) {
      title = "Order Request Submitted Successfully";

      message =
        "Thank you! Your order request has been received successfully. Our sales team will contact you shortly.";
    } else if (finalRequestType === LeadConstants.REQUEST_TYPES.QUOTATION) {
      title = "Quotation Request Submitted Successfully";

      message =
        "Thank you! Your quotation request has been received. Our sales team will review your requirements and contact you shortly.";
    } else if (finalRequestType === LeadConstants.REQUEST_TYPES.EXPERT) {
      title = "Expert Request Submitted Successfully";

      message =
        "Thank you! Your request has been received. Our printing expert will contact you shortly.";
    } else if (finalRequestType === LeadConstants.REQUEST_TYPES.CONTACT_SALES) {
      title = "Sales Request Submitted Successfully";

      message =
        "Thank you! Your request has been received. Our sales team will contact you shortly.";
    }

    // ==========================================================
    // 14. RESPONSE
    // ==========================================================

    state.response = responseBuilder.lead({
      status: "COMPLETED",

      lead: result.lead,

      ...(result.order
        ? {
            order: result.order,
          }
        : {}),

      response: {
        step: "LEAD_COMPLETED",

        title,

        message,
      },
    });

    // ==========================================================
    // 15. ASSISTANT MESSAGE
    // ==========================================================

    state.assistantMessage = message;

    return state;
  }

  buildReviewMessage(order = {}, customer = {}) {
    const lines = ["*Please review your order details:*"];
    for (const item of order.items ?? []) {
      const product = item.selectedProduct ?? item.product ?? {};
      const name =
        product.name ??
        product.productName ??
        product.title ??
        product.slug ??
        "Product";
      const fields = item.formData ?? item.productData ?? {};
      const quantity = fields.quantity ?? item.workflow?.quantity ?? null;
      lines.push(`• *Product*: ${name}`);
      if (quantity != null) lines.push(`• *Quantity*: ${quantity}`);
      const artwork = item.workflow?.artwork ?? fields.artwork;
      if (artwork) {
        const artText =
          typeof artwork === "object"
            ? artwork.status === "UPLOADED"
              ? "Uploaded file"
              : artwork.status
            : artwork === "have_artwork"
              ? "Print-ready artwork"
              : artwork === "need_design"
                ? "Design service requested"
                : artwork;
        lines.push(`• *Artwork*: ${artText}`);
      }
      for (const [key, value] of Object.entries(fields)) {
        if (
          [
            "quantity",
            "artwork",
            "deliveryMethod",
            "deliveryDate",
            "deliveryAddress",
          ].includes(key)
        )
          continue;
        if (value === undefined || value === null || value === "") continue;
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        lines.push(
          `• *${label}*: ${Array.isArray(value) ? value.join(", ") : value}`,
        );
      }
    }
    if (order.pricing?.total != null && order.pricing.total > 0) {
      lines.push(
        `• *Total Price*: ${order.pricing.currency ?? "AED"} ${order.pricing.total}`,
      );
    }
    if (order.delivery?.method) {
      const methodLabel =
        order.delivery.method === "pickup" ? "Store Pickup" : "Delivery";
      lines.push(`• *Method*: ${methodLabel}`);
    }
    if (order.delivery?.requiredDate)
      lines.push(`• *Date*: ${order.delivery.requiredDate}`);
    if (order.delivery?.address)
      lines.push(`• *Address*: ${order.delivery.address}`);
    if (customer?.name) lines.push(`• *Customer*: ${customer.name}`);
    if (customer?.phone) lines.push(`• *Phone*: ${customer.phone}`);
    if (customer?.email) lines.push(`• *Email*: ${customer.email}`);
    lines.push("\nIs everything correct?");
    return lines.join("\n");
  }

  // ============================================================
  // FLOW RESPONSE EXTRACTION
  // ============================================================

  extractFlowResponse(state = {}) {
    const payload = state.action?.payload ?? {};

    // ----------------------------------------------------------
    // Preferred WhatsApp Flow response
    // ----------------------------------------------------------

    const candidates = [
      payload.responseJson,
      payload.flowResponse,
      payload.values,
      payload.fields,
      payload.data,
      state.whatsapp?.flowResponse,
      state.flowResponse,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeFlowResponse(candidate);

      if (normalized && Object.keys(normalized).length > 0) {
        return normalized;
      }
    }

    return {};
  }

  // ============================================================
  // NORMALIZE FLOW RESPONSE
  // ============================================================

  normalizeFlowResponse(value) {
    if (!value) {
      return null;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return value;
    }

    if (typeof value !== "string") {
      return null;
    }

    try {
      const parsed = JSON.parse(value);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }

    return null;
  }

  // ============================================================
  // REQUEST TYPE FALLBACK
  // ============================================================

  inferRequestType(state = {}) {
    const requirement =
      state.liveRequirement ??
      state.order ??
      state.orderContext ??
      state.productSales ??
      null;

    if (Array.isArray(requirement?.items) && requirement.items.length > 0) {
      return LeadConstants.REQUEST_TYPES.ORDER;
    }

    return LeadConstants.REQUEST_TYPES.EXPERT;
  }
}
