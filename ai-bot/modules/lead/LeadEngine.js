import LeadExtractor from "./extractors/LeadExtractor.js";
import LeadValidator from "./LeadValidator.js";
import LeadBuilder from "./builders/LeadBuilder.js";
import LeadService from "./LeadService.js";

import LeadConstants from "./helpers/LeadConstants.js";

const leadExtractor = new LeadExtractor();

const leadValidator = new LeadValidator();

const leadBuilder = new LeadBuilder();

const leadService = new LeadService();

export default class LeadEngine {
  async execute(state = {}) {
    console.log("========== WHATSAPP LEAD ENGINE ==========");

    const channel = state.channel ?? state.whatsapp?.channel ?? "WEBCHAT";

    const isWhatsApp = channel === LeadConstants.CHANNELS.WHATSAPP;

    /*
     * =====================================================
     * LEAD CONTEXT
     * =====================================================
     */

    const leadContext = state.leadContext ?? {};

    /*
     * =====================================================
     * REQUIREMENT / ORDER
     * =====================================================
     */

    const requirement =
      state.orderContext ??
      state.order ??
      state.liveRequirement ??
      state.productSales ??
      {};

    /*
     * =====================================================
     * ORDER DETECTION
     * =====================================================
     */

    const hasOrder =
      Array.isArray(requirement.items) && requirement.items.length > 0;

    /*
     * =====================================================
     * SESSION
     * =====================================================
     */

    const sessionId =
      state.sessionId ??
      state.conversation?.sessionId ??
      state.persistence?.conversation?.sessionId ??
      null;

    /*
     * =====================================================
     * REQUEST TYPE
     * =====================================================
     */

    const conversationRequestType =
      state.conversation?.requestType ??
      state.persistence?.conversation?.requestType ??
      null;

    const routingRequestType = state.routing?.requestType ?? null;

    const requestType =
      conversationRequestType ??
      leadContext.requestType ??
      state.requestType ??
      routingRequestType ??
      (hasOrder
        ? LeadConstants.REQUEST_TYPES.ORDER
        : LeadConstants.REQUEST_TYPES.EXPERT);

    state.requestType = requestType;

    state.leadContext = {
      ...leadContext,
      requestType,
    };

    /*
     * =====================================================
     * SAVE REQUEST TYPE
     * =====================================================
     */

    if (sessionId && requestType && conversationRequestType !== requestType) {
      await leadService.updateConversationRequestType(sessionId, requestType);
    }

    const hasCustomerData =
      Boolean(state.customer?.name || requirement.customer?.name) &&
      Boolean(
        state.customer?.email ||
        state.customer?.emailId ||
        requirement.customer?.email ||
        requirement.customer?.emailId,
      );

    const isDirectSubmission =
      hasCustomerData ||
      state.action?.id === LeadConstants.ACTIONS.SUBMIT_LEAD;

    /*
     * =====================================================
     * FIRST LEAD ENTRY
     * =====================================================
     */

    if (!isDirectSubmission) {
      console.log("WhatsApp lead form required.");

      /*
       * IMPORTANT:
       *
       * WhatsAppResponseAdapter will render interactive
       * lead collection controls.
       */

      if (isWhatsApp) {
        return {
          status: "COLLECTING_CUSTOMER",

          completed: false,

          interaction: "FORM",

          requestType,

          leadContext,

          order: requirement,
        };
      }

      /*
       * =================================================
       * WEBCHAT FALLBACK
       * =================================================
       *
       * Keep only if WebChat is still used.
       */

      return {
        status: "COLLECTING_CUSTOMER",

        completed: false,

        interaction: "FORM",

        requestType,

        form: {
          step: "COLLECT_CUSTOMER",

          type: "FORM",

          title:
            requestType === LeadConstants.REQUEST_TYPES.ORDER
              ? "Complete Your Order"
              : "Talk to Our Sales Team",

          fields: [
            {
              id: "name",
              label: "Full Name",
              type: "text",
              required: true,
            },

            {
              id: "phoneNumber",
              label: "Phone Number",
              type: "tel",
              required: true,
            },

            {
              id: "emailId",
              label: "Email Address",
              type: "email",
              required: false,
            },

            {
              id: "companyName",
              label: "Company Name",
              type: "text",
              required: false,
            },
          ],

          submitAction: {
            id: "SUBMIT_LEAD",
            label: "Submit",
          },
        },
      };
    }

    /*
     * =====================================================
     * EXTRACT WHATSAPP FLOW DATA
     * =====================================================
     */

    const extractedLead = leadExtractor.extract(state);

    console.log("Extracted WhatsApp Lead:");

    console.dir(extractedLead, { depth: null });

    /*
     * =====================================================
     * VALIDATE
     * =====================================================
     */

    const validatedLead = leadValidator.validate(extractedLead, {
      channel,
    });

    /*
     * =====================================================
     * REF NUMBER
     * =====================================================
     */

    const refNo = await leadService.getNextRefNumber();

    /*
     * =====================================================
     * BUILD
     * =====================================================
     */

    const leadDocument = leadBuilder.build(
      validatedLead,
      refNo,
      requirement,
      channel,
    );

    /*
     * =====================================================
     * SAVE
     * =====================================================
     */

    const savedLead = await leadService.createLead(
      leadDocument,
      requestType === LeadConstants.REQUEST_TYPES.ORDER,
    );

    /*
     * =====================================================
     * ATTACH LEAD TO ORDER
     * =====================================================
     */

    let updatedOrder = null;

    if (requestType === LeadConstants.REQUEST_TYPES.ORDER && hasOrder) {
      const orderId =
        requirement._id ??
        requirement.id ??
        state.orderContext?._id ??
        state.order?._id ??
        state.liveRequirement?._id;

      const customer = {
        name: savedLead.name ?? null,

        company: savedLead.companyName ?? null,

        phone: savedLead.phoneNumber ?? null,

        email: savedLead.emailId ?? null,
      };

      if (orderId) {
        updatedOrder = await leadService.updateOrderAfterLead(
          orderId,
          customer,
          savedLead._id,
          savedLead,
        );
      }
    }

    /*
     * =====================================================
     * COMPLETED
     * =====================================================
     */

    return {
      status: "COMPLETED",

      completed: true,

      interaction: "WHATSAPP",

      lead: savedLead,

      order: updatedOrder,

      whatsapp: {
        phoneNumber: state.whatsapp?.phoneNumber ?? savedLead.phoneNumber,

        message: "Thank you! Our sales team will contact you shortly.",
      },
    };
  }
}
