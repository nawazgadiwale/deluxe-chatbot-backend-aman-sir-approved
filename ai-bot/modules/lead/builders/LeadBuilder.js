import crypto from "crypto";
import LeadConstants from "../helpers/LeadConstants.js";

export default class LeadBuilder {
  /*
   * =====================================================
   * RESOLVE BILLING ADDRESS
   * =====================================================
   *
   * Rules:
   *
   * 1. Delivery + delivery address
   *      -> use delivery address
   *
   * 2. Pickup
   *      -> Dubai
   *
   * 3. Delivery without address
   *      -> Dubai
   *
   * 4. Anything without an address
   *      -> Dubai
   *
   * The order/requirement is treated as the
   * authoritative source for delivery information.
   */

  resolveBillingAddress(order = {}, lead = {}) {
    /*
     * =====================================================
     * DELIVERY METHOD
     * =====================================================
     *
     * Support the common structures used by the
     * existing order state.
     */

    const deliveryMethod =
      order.delivery?.method ??
      order.delivery?.type ??
      order.deliveryMethod ??
      order.deliveryType ??
      order.fulfillmentMethod ??
      order.fulfillmentType ??
      "";

    /*
     * =====================================================
     * DELIVERY ADDRESS
     * =====================================================
     */

    const deliveryAddress =
      order.delivery?.address ??
      order.delivery?.deliveryAddress ??
      order.deliveryAddress ??
      order.address ??
      lead.delivery?.address ??
      lead.deliveryAddress ??
      lead.address ??
      "";

    const normalizedMethod = String(deliveryMethod).trim().toLowerCase();

    const normalizedAddress = String(deliveryAddress ?? "").trim();

    /*
     * =====================================================
     * DELIVERY + ADDRESS
     * =====================================================
     */

    if (normalizedMethod === "delivery" && normalizedAddress) {
      return normalizedAddress;
    }

    /*
     * =====================================================
     * DEFAULT
     * =====================================================
     *
     * Pickup:
     *     Dubai
     *
     * Delivery without address:
     *     Dubai
     *
     * Missing method:
     *     Dubai
     */

    return "Dubai";
  }

  build(lead = {}, refNo, order = {}) {
    /*
     * =====================================================
     * PRODUCTS
     * =====================================================
     */

    let products = [];

    if (Array.isArray(lead.products) && lead.products.length > 0) {
      products = lead.products.map((product) => ({
        productName: String(product.productName ?? "").trim(),

        productId: product.productId ?? null,
      }));
    } else if (lead.required_item) {
      products = [
        {
          productName: String(lead.required_item).trim(),

          productId: LeadConstants.PRODUCT_ID ?? null,
        },
      ];
    }

    /*
     * =====================================================
     * BILLING ADDRESS
     * =====================================================
     */

    const billingAddress = this.resolveBillingAddress(order, lead);

    /*
     * =====================================================
     * BUILD LEAD
     * =====================================================
     */

    return {
      /*
       * =================================================
       * IDENTITY
       * =================================================
       */

      refNo,

      uid: crypto.randomUUID(),

      /*
       * =================================================
       * CUSTOMER
       * =================================================
       */

      name: lead.name,

      phoneNumber: lead.phoneNumber,

      emailId: lead.emailId ?? "",

      companyName: lead.companyName ?? "",

      billingAddress,

      /*
       * =================================================
       * LEAD SOURCE
       * =================================================
       */

      source: LeadConstants.SOURCE,

      /*
       * =================================================
       * PRODUCTS
       * =================================================
       */

      products,

      /*
       * =================================================
       * CRM
       * =================================================
       */

      division: lead.division ?? "N/A",

      assignToSalesPerson: lead.assignToSalesPerson ?? "Admin",

      dealStatus: "Open",

      dealAmount: 0,

      quoteNumber: 0,

      quoteDate: null,

      initialRemartks: lead.initialRemartks ?? "",

      invoiceNumber: 0,

      invoiceDate: null,

      assignFollowUp: "NA",

      followUpInstruction: "",

      followUps: [],
    };
  }
}
