import LeadMessages from "./helpers/LeadMessages.js";

export default class LeadValidator {
  validate(lead = {}, options = {}) {
    const channel = options.channel ?? "WEBCHAT";

    if (!String(lead.name ?? "").trim()) {
      throw new Error(LeadMessages.NAME_REQUIRED);
    }

    lead.name = String(lead.name).trim();

    if (!String(lead.phoneNumber ?? "").trim()) {
      throw new Error(LeadMessages.PHONE_REQUIRED);
    }

    lead.phoneNumber = String(lead.phoneNumber).replace(/\s+/g, "").trim();

    const phoneRegex = /^\+?[0-9]{7,15}$/;

    if (!phoneRegex.test(lead.phoneNumber)) {
      throw new Error(LeadMessages.INVALID_PHONE);
    }

    if (lead.emailId) {
      lead.emailId = String(lead.emailId).trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(lead.emailId)) {
        throw new Error(LeadMessages.INVALID_EMAIL);
      }
    }

    if (Array.isArray(lead.products)) {
      lead.products = lead.products
        .filter((product) => product?.productName)
        .map((product) => ({
          productName: String(product.productName).trim(),

          productId: product.productId ?? null,
        }));
    }

    return lead;
  }
}
