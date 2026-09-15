import LeadMessages from "./helpers/LeadMessages.js";

export default class LeadValidator {
  validate(lead = {}) {
    /* =====================================================
     * NAME
     * ===================================================== */

    if (!String(lead.name ?? "").trim()) {
      throw new Error(LeadMessages.NAME_REQUIRED);
    }

    lead.name = String(lead.name).trim();

    /* =====================================================
     * WHATSAPP PHONE
     * =====================================================
     *
     * Phone is NOT collected from the user.
     * LeadEngine injects the WhatsApp sender number.
     */

    if (!String(lead.phoneNumber ?? "").trim()) {
      throw new Error(LeadMessages.PHONE_REQUIRED);
    }

    lead.phoneNumber = String(lead.phoneNumber)
      .replace(/\s+/g, "")
      .trim();

    const phoneRegex = /^\+?[0-9]{7,15}$/;

    if (!phoneRegex.test(lead.phoneNumber)) {
      throw new Error(LeadMessages.INVALID_PHONE);
    }

    /* =====================================================
     * EMAIL - OPTIONAL
     * ===================================================== */

    if (lead.emailId != null && String(lead.emailId).trim()) {
      lead.emailId = String(lead.emailId).trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(lead.emailId)) {
        throw new Error(LeadMessages.INVALID_EMAIL);
      }
    } else {
      lead.emailId = null;
    }

    /* =====================================================
     * COMPANY - OPTIONAL
     * ===================================================== */

    if (
      lead.companyName != null &&
      String(lead.companyName).trim()
    ) {
      lead.companyName = String(lead.companyName).trim();
    } else {
      lead.companyName = null;
    }

    /* =====================================================
     * PRODUCTS
     * ===================================================== */

    if (Array.isArray(lead.products)) {
      lead.products = lead.products
        .filter((product) => product?.productName)
        .map((product) => ({
          productName: String(product.productName).trim(),
          productId:
            typeof product.productId === "number" && !Number.isNaN(product.productId)
              ? product.productId
              : (typeof product.productId === "string" && /^\d+$/.test(product.productId.trim()))
                ? Number(product.productId.trim())
                : null,
        }));
    }

    return lead;
  }
}