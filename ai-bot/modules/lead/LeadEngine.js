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
    console.log("========== LEAD ENGINE ==========");

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
     *
     * REQUEST TYPE BELONGS TO CONVERSATION.
     *
     * Priority:
     *
     * 1. Existing Conversation requestType
     * 2. Runtime leadContext requestType
     * 3. Runtime state requestType
     * 4. Routing requestType
     * 5. ORDER if actual order exists
     * 6. EXPERT fallback
     *
     * The frontend action is NOT trusted.
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

    /*
     * =====================================================
     * PRESERVE RUNTIME REQUEST TYPE
     * =====================================================
     */

    state.requestType = requestType;

    state.leadContext = {
      ...leadContext,
      requestType,
    };

    console.log("Lead Request Type:", requestType);

    console.log("Lead Has Order:", hasOrder);

    /*
     * =====================================================
     * PERSIST REQUEST TYPE IN CONVERSATION
     * =====================================================
     */

    if (sessionId && requestType && conversationRequestType !== requestType) {
      await leadService.updateConversationRequestType(sessionId, requestType);
    }

    /*
     * =====================================================
     * FIRST ENTRY
     * =====================================================
     */

    if (state.action?.id !== "SUBMIT_LEAD") {
      console.log("Lead form required - waiting for customer details");

      /*
       * =================================================
       * CUSTOMER
       * =================================================
       */

      const customer = requirement.customer ?? state.customer ?? {};

      /*
       * =================================================
       * FORM CONFIGURATION
       * =================================================
       */

      let title = "Talk to Our Sales Team";

      let subtitle = "Please provide your contact information";

      let message =
        "Please provide your contact information so our sales team can assist you.";

      let description = "Our sales team will contact you shortly.";

      /*
       * =================================================
       * ORDER
       * =================================================
       */

      if (requestType === LeadConstants.REQUEST_TYPES.ORDER) {
        title = "Complete Your Order";

        subtitle = "Please provide your contact information";

        message =
          "Your order details are ready. Please provide your contact information so our sales team can process your request.";

        description =
          "Our sales team will contact you to confirm the order and final quotation.";
      }

      /*
       * =================================================
       * QUOTATION
       * =================================================
       */

      if (requestType === LeadConstants.REQUEST_TYPES.QUOTATION) {
        title = "Request a Quotation";

        subtitle = "Tell us what you need a quotation for";

        message =
          "Please provide the item or printing requirement you need a quotation for, along with your contact information.";

        description =
          "Our sales team will review your requirements and contact you with the quotation.";
      }

      /*
       * =================================================
       * EXPERT
       * =================================================
       */

      if (requestType === LeadConstants.REQUEST_TYPES.EXPERT) {
        title = "Talk to an Expert";

        subtitle = "Tell us what you need help with";

        message =
          "Please tell us what you need help with and provide your contact information so our printing expert can assist you.";

        description = "Our printing expert will contact you shortly.";
      }

      /*
       * =================================================
       * CONTACT SALES
       * =================================================
       */

      if (requestType === LeadConstants.REQUEST_TYPES.CONTACT_SALES) {
        title = "Contact Sales";

        subtitle = "Tell us what you would like to discuss";

        message =
          "Please tell us what you would like to discuss and provide your contact information so our sales team can assist you.";

        description = "Our sales team will contact you shortly.";
      }

      /*
       * =================================================
       * FIELDS
       * =================================================
       */

      const fields = [];

      /*
       * =================================================
       * REQUIRED ITEM
       * =================================================
       */

      if (requestType !== LeadConstants.REQUEST_TYPES.ORDER) {
        let label = "What do you need assistance with?";

        let placeholder = "e.g. Business cards, signage, packaging";

        if (requestType === LeadConstants.REQUEST_TYPES.QUOTATION) {
          label = "What would you like a quotation for?";

          placeholder = "e.g. Business cards, flyers, brochures";
        }

        if (requestType === LeadConstants.REQUEST_TYPES.EXPERT) {
          label = "What would you like help with?";

          placeholder = "e.g. Business cards, signage, packaging";
        }

        if (requestType === LeadConstants.REQUEST_TYPES.CONTACT_SALES) {
          label = "What would you like to discuss with sales?";

          placeholder = "e.g. Business cards, signage, bulk printing";
        }

        fields.push({
          id: "requiredItem",

          label,

          placeholder,

          type: "text",

          required: true,

          value: leadContext.requiredItem ?? "",
        });
      }

      /*
       * =================================================
       * NAME
       * =================================================
       */

      fields.push({
        id: "name",

        label: "Full Name",

        placeholder: "Enter your full name",

        type: "text",

        required: true,

        value: customer.name ?? "",
      });

      /*
       * =================================================
       * PHONE
       * =================================================
       */

      fields.push({
        id: "phoneNumber",

        label: "Phone Number",

        placeholder: "Enter your phone number",

        type: "tel",

        required: true,

        value: customer.phone ?? customer.phoneNumber ?? "",
      });

      /*
       * =================================================
       * EMAIL
       * =================================================
       */

      fields.push({
        id: "emailId",

        label: "Email Address",

        placeholder: "Enter your email address",

        type: "email",

        required: false,

        value: customer.email ?? customer.emailId ?? "",
      });

      /*
       * =================================================
       * COMPANY
       * =================================================
       */

      fields.push({
        id: "companyName",

        label: "Company Name",

        placeholder: "Enter your company name",

        type: "text",

        required: false,

        value: customer.company ?? customer.companyName ?? "",
      });

      /*
       * =================================================
       * SUBMIT LABEL
       * =================================================
       */

      let submitLabel = "Submit Order Request";

      if (requestType === LeadConstants.REQUEST_TYPES.QUOTATION) {
        submitLabel = "Request Quotation";
      }

      if (requestType === LeadConstants.REQUEST_TYPES.EXPERT) {
        submitLabel = "Talk to Expert";
      }

      if (requestType === LeadConstants.REQUEST_TYPES.CONTACT_SALES) {
        submitLabel = "Contact Sales";
      }

      /*
       * =================================================
       * FORM
       * =================================================
       */

      return {
        status: "COLLECTING_CUSTOMER",

        completed: false,

        form: {
          step: "COLLECT_CUSTOMER",

          type: "FORM",

          title,

          subtitle,

          message,

          description,

          fields,

          /*
           * IMPORTANT:
           *
           * requestType is NOT sent to frontend.
           *
           * Backend already knows it from
           * Conversation.
           */

          submitAction: {
            id: "SUBMIT_LEAD",

            label: submitLabel,
          },
        },
      };
    }

    /*
     * =====================================================
     * EXTRACT
     * =====================================================
     */

    const extractedLead = leadExtractor.extract(state);

    console.log("Extracted Lead:");

    console.dir(extractedLead, {
      depth: null,
    });

    /*
     * =====================================================
     * VALIDATE
     * =====================================================
     */

    const validatedLead = leadValidator.validate(extractedLead);

    console.log("Validated Lead:");

    console.dir(validatedLead, {
      depth: null,
    });

    /*
     * =====================================================
     * REF NUMBER
     * =====================================================
     */

    const refNo = await leadService.getNextRefNumber();

    console.log("Generated Ref No:", refNo);

    /*
     * =====================================================
     * BUILD
     * =====================================================
     */

    const leadDocument = leadBuilder.build(validatedLead, refNo, requirement);

    console.log("Lead Document:");

    console.dir(leadDocument, {
      depth: null,
    });

    /*
     * =====================================================
     * SAVE LEAD
     * =====================================================
     *
     * requestType is NOT inside leadDocument.
     */

    const savedLead = await leadService.createLead(
      leadDocument,
      requestType === LeadConstants.REQUEST_TYPES.ORDER,
    );

    /*
     * =====================================================
     * UPDATE EXISTING ORDER
     * =====================================================
     */

    let updatedOrder = null;

    if (requestType === LeadConstants.REQUEST_TYPES.ORDER && hasOrder) {
      /*
       * =================================================
       * RESOLVE REAL ORDER ID
       * =================================================
       */

      const orderId =
        requirement._id ??
        requirement.id ??
        state.orderContext?._id ??
        state.order?._id ??
        state.liveRequirement?._id;

      console.log("Order ID for Lead Attachment:", orderId);

      /*
       * =================================================
       * CUSTOMER
       * =================================================
       */

      const customer = {
        name: savedLead.name ?? null,

        company: savedLead.companyName ?? null,

        phone: savedLead.phoneNumber ?? null,

        email: savedLead.emailId ?? null,
      };

      /*
       * =================================================
       * UPDATE ORDER
       * =================================================
       */

      if (orderId) {
        updatedOrder = await leadService.updateOrderAfterLead(
          orderId,
          customer,
          savedLead._id,
          savedLead,
        );
      } else {
        console.warn("ORDER EXISTS BUT NO ORDER ID WAS FOUND.");
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

      lead: savedLead,

      order: updatedOrder,
    };
  }
}
