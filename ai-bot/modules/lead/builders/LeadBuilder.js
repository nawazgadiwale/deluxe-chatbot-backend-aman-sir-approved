import crypto from "crypto";
import LeadConstants from "../helpers/LeadConstants.js";

export default class LeadBuilder {
  resolveBillingAddress(order = {}, lead = {}) {
    const deliveryMethod =
      order.delivery?.method ??
      order.delivery?.type ??
      order.deliveryMethod ??
      order.deliveryType ??
      order.fulfillmentMethod ??
      order.fulfillmentType ??
      "";

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

    if (normalizedMethod === "delivery" && normalizedAddress) {
      return normalizedAddress;
    }

    return "Dubai";
  }

  build(
    lead = {},
    refNo,
    order = {},
    channel = LeadConstants.CHANNELS.WEBCHAT,
  ) {
    const products = this.extractProducts(order, lead);

    const billingAddress = this.resolveBillingAddress(order, lead);

    const source =
      channel === LeadConstants.CHANNELS.WHATSAPP
        ? LeadConstants.SOURCES.WHATSAPP
        : LeadConstants.SOURCES.WEBCHAT;

    return {
      refNo,

      uid: crypto.randomUUID(),

      name: String(lead.name ?? "").trim(),

      phoneNumber: String(lead.phoneNumber ?? "").trim(),

      emailId: String(lead.emailId ?? "").trim(),

      companyName: String(lead.companyName ?? "").trim(),

      billingAddress,

      source,

      products,

      requestType: lead.requestType ?? LeadConstants.REQUEST_TYPES.ORDER,

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

  extractProducts(order = {}, lead = {}) {
    const items = Array.isArray(order.items) ? order.items : [];

    const products = [];

    for (const item of items) {
      const parent = item.product ?? {};

      const selected = item.selectedProduct ?? {};

      const product = selected.id ? selected : parent;

      const productName =
        product.name ??
        product.productName ??
        product.title ??
        product.slug ??
        "";

      if (!productName) {
        continue;
      }

      products.push({
        productName: String(productName).trim(),

        productId: this.resolveProductId(product.id ?? product.productId ?? null),
      });
    }

    /*
     * For non-order leads there may be contextual
     * products selected during discovery.
     */
    if (products.length === 0 && Array.isArray(lead.products)) {
      for (const product of lead.products) {
        if (!product) {
          continue;
        }

        const productName =
          product.productName ??
          product.name ??
          product.title ??
          product.slug ??
          "";

        if (!productName) {
          continue;
        }

        products.push({
          productName: String(productName).trim(),

          productId: this.resolveProductId(product.productId ?? product.id ?? null),
        });
      }
    }

    return this.uniqueProducts(products);
  }

  resolveProductId(rawId) {
    if (typeof rawId === "number" && !Number.isNaN(rawId)) {
      return rawId;
    }
    if (typeof rawId === "string" && /^\d+$/.test(rawId.trim())) {
      return Number(rawId.trim());
    }
    return LeadConstants.PRODUCT_ID;
  }

  uniqueProducts(products = []) {
    const seen = new Set();

    return products.filter((product) => {
      const key = product.productId
        ? `id:${product.productId}`
        : `name:${product.productName.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
  }
}
