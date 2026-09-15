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

    const channel =
      state.channel ??
      state.whatsapp?.channel ??
      LeadConstants.CHANNELS.WEBCHAT;

    const leadContext = state.leadContext ?? {};

    const requirement =
      state.order ??
      state.orderContext ??
      state.liveRequirement ??
      state.productSales ??
      {};

    const hasOrder =
      Array.isArray(requirement.items) &&
      requirement.items.length > 0;

    const requestType =
      state.requestType ??
      leadContext.requestType ??
      (hasOrder
        ? LeadConstants.REQUEST_TYPES.ORDER
        : LeadConstants.REQUEST_TYPES.EXPERT);

    state.requestType = requestType;

    state.leadContext = {
      ...leadContext,
      requestType,
    };

    /*
     * ==========================================================
     * WHATSAPP NUMBER
     * ==========================================================
     *
     * Never ask the customer for this.
     */

    const whatsappNumber =
      state.whatsapp?.phoneNumber ??
      state.whatsapp?.from ??
      state.phoneNumber ??
      null;

    if (!whatsappNumber) {
      throw new Error(
        "WhatsApp phone number is required to create a lead.",
      );
    }

    /*
     * ==========================================================
     * EXTRACT
     * ==========================================================
     */

    const extractedLead =
      leadExtractor.extract(state);

    /*
     * Channel identity is authoritative.
     */

    extractedLead.phoneNumber = whatsappNumber;

    /*
     * ==========================================================
     * VALIDATE
     * ==========================================================
     */

    const validatedLead =
      leadValidator.validate(
        extractedLead,
        { channel },
      );

    /*
     * ==========================================================
     * REFERENCE NUMBER
     * ==========================================================
     */

    const refNo =
      await leadService.getNextRefNumber();

    /*
     * ==========================================================
     * BUILD
     * ==========================================================
     */

    const leadDocument =
      leadBuilder.build(
        validatedLead,
        refNo,
        requirement,
        channel,
      );

    /*
     * ==========================================================
     * CREATE LEAD
     * ==========================================================
     */

    const isOrder =
      requestType ===
      LeadConstants.REQUEST_TYPES.ORDER;

    const savedLead =
      await leadService.createLead(
        leadDocument,
        isOrder,
      );

    /*
     * ==========================================================
     * ATTACH LEAD TO ORDER
     * ==========================================================
     */

    let updatedOrder = null;

    if (isOrder && hasOrder) {
      const orderId =
        state.order?._id ??
        state.orderContext?._id ??
        state.liveRequirement?._id ??
        null;

      if (!orderId) {
        throw new Error(
          "Current order _id is required before creating an order lead.",
        );
      }

      updatedOrder =
        await leadService.updateOrderAfterLead(
          orderId,
          {
            name:
              savedLead.name ?? null,

            phone:
              savedLead.phoneNumber ?? null,

            email:
              savedLead.emailId ?? null,

            company:
              savedLead.companyName ?? null,
          },
          savedLead._id,
          savedLead,
        );
    }

    return {
      status: "COMPLETED",
      completed: true,
      lead: savedLead,
      order: updatedOrder,
      customer: {
        name: savedLead.name,
        phone: savedLead.phoneNumber,
        email: savedLead.emailId ?? null,
        company: savedLead.companyName ?? null,
      },
      message:
        "Thank you. Your details have been received successfully.",
    };
  }
}