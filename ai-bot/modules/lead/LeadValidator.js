import LeadMessages from "./helpers/LeadMessages.js";

export default class LeadValidator {
  validate(lead = {}) {
    /*
     * =====================================================
     * NAME
     * =====================================================
     */

    if (!lead.name?.trim()) {
      throw new Error(LeadMessages.NAME_REQUIRED);
    }

    lead.name = lead.name.trim();

    /*
     * =====================================================
     * PHONE
     * =====================================================
     */

    if (!lead.phoneNumber?.trim()) {
      throw new Error(LeadMessages.PHONE_REQUIRED);
    }

    lead.phoneNumber = lead.phoneNumber.replace(/\s+/g, "").trim();

    const phoneRegex = /^\+?[0-9]{7,15}$/;

    if (!phoneRegex.test(lead.phoneNumber)) {
      throw new Error(LeadMessages.INVALID_PHONE);
    }

    /*
     * =====================================================
     * EMAIL
     * =====================================================
     */

    if (lead.emailId) {
      lead.emailId = lead.emailId.trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(lead.emailId)) {
        throw new Error(LeadMessages.INVALID_EMAIL);
      }
    }

    /*
     * =====================================================
     * PRODUCTS
     * =====================================================
     *
     * productId is intentionally NOT cast.
     *
     * It may be:
     *
     * "business-cards"
     * "flyers"
     * "123"
     * null
     */

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
