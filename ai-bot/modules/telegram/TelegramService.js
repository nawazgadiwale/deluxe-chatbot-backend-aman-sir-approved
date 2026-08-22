import axios from "axios";

export default class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enabled = process.env.TELEGRAM_ENABLED === "true";

    if (this.enabled && (!this.token || !this.chatId)) {
      throw new Error(
        "Telegram configuration missing. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
      );
    }
  }

  // =====================================================
  // HTML ESCAPE
  // =====================================================

  escape(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // =====================================================
  // SAFE VALUE
  // =====================================================

  value(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return this.escape(value);
  }

  // =====================================================
  // OBJECT TO TEXT
  // =====================================================

  formatObject(object = {}) {
    if (!object || typeof object !== "object") {
      return "";
    }

    return Object.entries(object)
      .filter(
        ([, value]) => value !== null && value !== undefined && value !== "",
      )
      .map(([key, value]) => {
        let formattedValue = value;

        if (typeof value === "object") {
          try {
            formattedValue = JSON.stringify(value);
          } catch {
            formattedValue = String(value);
          }
        }

        return `• <b>${this.escape(key)}:</b> ${this.escape(formattedValue)}`;
      })
      .join("\n");
  }

  // =====================================================
  // SEND TELEGRAM MESSAGE
  // =====================================================

  async send(message) {
    console.log("========== TELEGRAM SEND ==========");
    console.log("Enabled:", this.enabled);
    console.log("Chat ID:", this.chatId);

    if (!this.enabled) {
      console.log("Telegram notifications are disabled.");
      return false;
    }

    if (!message) {
      console.log("Telegram message is empty.");
      return false;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      );

      console.log("Telegram message sent successfully.");

      return true;
    } catch (error) {
      console.error("Telegram Error:", error.response?.data || error.message);

      return false;
    }
  }

  // =====================================================
  // LEAD NOTIFICATION
  // =====================================================

  async sendLead(lead = {}) {
    console.log("========== SEND LEAD ==========");
    console.dir(lead, { depth: null });

    const products = lead.products ?? [];

    const productText =
      products.length > 0
        ? products
            .map((product, index) => {
              return `
<b>${index + 1}. ${this.value(
                product.productName ?? product.name ?? product.title,
              )}</b>

🆔 Product ID: ${this.value(product.productId ?? product.id)}
`;
            })
            .join("\n")
        : "No product specified";

    const message = `
<b>🆕 NEW LEAD</b>

━━━━━━━━━━━━━━━━━━

<b>👤 CUSTOMER</b>

🆔 Reference: ${this.value(lead.refNo)}

👤 Name: ${this.value(lead.name)}

📞 Phone: ${this.value(lead.phoneNumber)}

📧 Email: ${this.value(lead.emailId)}

🏢 Company: ${this.value(lead.companyName)}

━━━━━━━━━━━━━━━━━━

<b>📋 LEAD INFORMATION</b>

📍 Source: ${this.value(lead.source)}

🏷️ Division: ${this.value(lead.division)}

📊 Status: ${this.value(lead.dealStatus)}

👨‍💼 Sales Person: ${this.value(lead.assignToSalesPerson)}

━━━━━━━━━━━━━━━━━━

<b>📦 PRODUCTS</b>

${productText}

━━━━━━━━━━━━━━━━━━

🕒 Created: ${this.value(new Date().toLocaleString())}
`;

    return this.send(message.trim());
  }

  // =====================================================
  // COMPLETE LEAD + ORDER NOTIFICATION
  // =====================================================

  async sendLeadWithOrder(lead = {}, order = {}) {
    console.log("========== SEND LEAD + COMPLETE ORDER ==========");

    console.log("LEAD:");
    console.dir(lead, { depth: null });

    console.log("ORDER:");
    console.dir(order, { depth: null });

    // ---------------------------------------------------
    // CUSTOMER
    // ---------------------------------------------------

    const customer = order.customer ?? {};

    // ---------------------------------------------------
    // ORDER ITEMS
    // ---------------------------------------------------

    const items = order.items ?? order.products ?? [];

    const productText =
      items.length > 0
        ? items
            .map((item, index) => {
              const productName =
                item.product?.name ??
                item.product?.title ??
                item.productName ??
                item.name ??
                "Unknown Product";

              const productId =
                item.product?.id ?? item.productId ?? item.id ?? "-";

              const quantity =
                item.workflow?.quantity ??
                item.quantity ??
                item.pricing?.quantity ??
                "-";

              const productData =
                item.productData ??
                item.specifications ??
                item.attributes ??
                {};

              const specificationText = this.formatObject(productData);

              // -----------------------------------------
              // ADDONS
              // -----------------------------------------

              const addons = item.addons ?? item.workflow?.addons ?? [];

              let addonText = "";

              if (Array.isArray(addons) && addons.length > 0) {
                addonText = addons
                  .map((addon) => {
                    if (typeof addon === "object") {
                      return `• ${this.value(
                        addon.name ??
                          addon.title ??
                          addon.id ??
                          JSON.stringify(addon),
                      )}`;
                    }

                    return `• ${this.value(addon)}`;
                  })
                  .join("\n");
              }

              // -----------------------------------------
              // ARTWORK
              // -----------------------------------------

              const artwork = item.workflow?.artwork ?? item.artwork ?? null;

              let artworkText = "";

              if (artwork) {
                if (typeof artwork === "object") {
                  artworkText = this.formatObject(artwork);
                } else {
                  artworkText = this.value(artwork);
                }
              }

              // -----------------------------------------
              // PRICING
              // -----------------------------------------

              const pricing = item.pricing ?? {};

              return `
<b>${index + 1}. ${this.value(productName)}</b>

🆔 Product ID: ${this.value(productId)}

📦 Quantity: ${this.value(quantity)}

${
  specificationText
    ? `
<b>⚙️ SPECIFICATIONS</b>

${specificationText}
`
    : ""
}

${
  addonText
    ? `
<b>➕ ADD-ONS</b>

${addonText}
`
    : ""
}

${
  artworkText
    ? `
<b>🎨 ARTWORK</b>

${artworkText}
`
    : ""
}

<b>💰 ITEM PRICING</b>

Unit Price: ${this.value(pricing.unitPrice)}

Subtotal: ${this.value(pricing.subtotal)}

Total: ${this.value(pricing.total)}
`;
            })
            .join("\n━━━━━━━━━━━━━━━━━━\n")
        : "No products found";

    // ===================================================
    // DELIVERY
    // ===================================================

    const delivery = order.delivery ?? order.deliveryDetails ?? {};

    const deliveryMethod =
      delivery.method ??
      order.deliveryMethod ??
      order.workflow?.deliveryMethod ??
      "-";

    const deliveryAddress = delivery.address ?? order.deliveryAddress ?? "-";

    const deliveryDate =
      delivery.requiredDate ?? delivery.date ?? order.deliveryDate ?? "-";

    // ===================================================
    // PRICING
    // ===================================================

    const pricing = order.pricing ?? {};

    const subtotal = pricing.subtotal ?? order.subtotal ?? "-";

    const deliveryCharge =
      pricing.delivery ?? pricing.deliveryCharge ?? order.deliveryCharge ?? "-";

    const tax = pricing.tax ?? order.tax ?? "-";

    const total =
      pricing.total ??
      order.total ??
      order.totalPrice ??
      order.grandTotal ??
      "-";

    const currency = pricing.currency ?? order.currency ?? "AED";

    // ===================================================
    // ORDER IDENTIFICATION
    // ===================================================

    const orderNumber = order.orderNumber ?? order.orderNo ?? order.id ?? "-";

    const sessionId = order.sessionId ?? lead.sessionId ?? "-";

    // ===================================================
    // MESSAGE
    // ===================================================

    const message = `
<b>🆕 NEW ORDER LEAD</b>

━━━━━━━━━━━━━━━━━━

<b>👤 CUSTOMER INFORMATION</b>

🆔 Reference: ${this.value(lead.refNo)}

👤 Name: ${this.value(lead.name ?? customer.name)}

📞 Phone: ${this.value(lead.phoneNumber ?? customer.phone)}

📧 Email: ${this.value(lead.emailId ?? customer.email)}

🏢 Company: ${this.value(lead.companyName ?? customer.company)}

━━━━━━━━━━━━━━━━━━

<b>📋 LEAD INFORMATION</b>

📍 Source: ${this.value(lead.source)}

🏷️ Division: ${this.value(lead.division)}

📊 Deal Status: ${this.value(lead.dealStatus)}

👨‍💼 Sales Person: ${this.value(lead.assignToSalesPerson)}

━━━━━━━━━━━━━━━━━━

<b>🛒 ORDER INFORMATION</b>

🆔 Order No: ${this.value(orderNumber)}

🆔 Session ID: ${this.value(sessionId)}

📦 Total Items: ${this.value(items.length)}

🔢 Total Quantity: ${this.value(order.totalQuantity ?? "-")}

━━━━━━━━━━━━━━━━━━

<b>📦 PRODUCTS</b>

${productText}

━━━━━━━━━━━━━━━━━━

<b>🚚 DELIVERY INFORMATION</b>

Method: ${this.value(deliveryMethod)}

Address: ${this.value(deliveryAddress)}

Required Date: ${this.value(deliveryDate)}

━━━━━━━━━━━━━━━━━━

<b>💰 ORDER SUMMARY</b>

Currency: ${this.value(currency)}

Subtotal: ${this.value(subtotal)}

Delivery: ${this.value(deliveryCharge)}

Tax: ${this.value(tax)}

<b>Total: ${this.value(total)}</b>

━━━━━━━━━━━━━━━━━━

🕒 Created: ${this.value(new Date().toLocaleString())}
`;

    return this.send(message.trim());
  }

  // =====================================================
  // ORDER ONLY
  // =====================================================

  async sendOrder(order = {}) {
    console.log("========== SEND ORDER ==========");

    if (!order) {
      console.log("Order is NULL");
      return false;
    }

    console.dir(order, { depth: null });

    const customer = order.customer ?? {};

    const items = order.items ?? order.products ?? [];

    const products =
      items.length > 0
        ? items
            .map((item, index) => {
              const product =
                item.product?.name ??
                item.product?.title ??
                item.productName ??
                item.name ??
                "Unknown Product";

              const productId = item.product?.id ?? item.productId ?? "-";

              const quantity = item.workflow?.quantity ?? item.quantity ?? "-";

              const specification =
                item.productData ?? item.specifications ?? {};

              const specificationText = this.formatObject(specification);

              const addons = item.addons ?? item.workflow?.addons ?? [];

              let addonText = "";

              if (Array.isArray(addons) && addons.length > 0) {
                addonText = addons
                  .map((addon) => {
                    if (typeof addon === "object") {
                      return `• ${this.value(
                        addon.name ?? addon.title ?? addon.id,
                      )}`;
                    }

                    return `• ${this.value(addon)}`;
                  })
                  .join("\n");
              }

              const pricing = item.pricing ?? {};

              return `
<b>${index + 1}. ${this.value(product)}</b>

🆔 Product ID: ${this.value(productId)}

📦 Qty: ${this.value(quantity)}

${specificationText ? `<b>Specifications</b>\n${specificationText}\n` : ""}

${addonText ? `<b>Add-ons</b>\n${addonText}\n` : ""}

💰 Unit Price: ${this.value(pricing.unitPrice)}

💰 Subtotal: ${this.value(pricing.subtotal)}

💰 Total: ${this.value(pricing.total)}
`;
            })
            .join("\n━━━━━━━━━━━━━━━━━━\n")
        : "No Products";

    const pricing = order.pricing ?? {};

    const message = `
<b>🛒 NEW ORDER RECEIVED</b>

━━━━━━━━━━━━━━━━━━

<b>👤 CUSTOMER</b>

👤 Name: ${this.value(customer.name)}

📞 Phone: ${this.value(customer.phone)}

📧 Email: ${this.value(customer.email)}

🏢 Company: ${this.value(customer.company)}

━━━━━━━━━━━━━━━━━━

<b>🆔 ORDER</b>

Order No: ${this.value(order.orderNumber ?? order.orderNo ?? order.id)}

Session: ${this.value(order.sessionId)}

━━━━━━━━━━━━━━━━━━

<b>📦 PRODUCTS</b>

${products}

━━━━━━━━━━━━━━━━━━

<b>💰 SUMMARY</b>

Total Items: ${this.value(items.length)}

Total Quantity: ${this.value(order.totalQuantity)}

Subtotal: ${this.value(pricing.subtotal ?? order.subtotal)}

Delivery: ${this.value(pricing.delivery ?? order.deliveryCharge)}

Tax: ${this.value(pricing.tax ?? order.tax)}

<b>Total: ${this.value(pricing.total ?? order.total ?? order.grandTotal)}</b>

━━━━━━━━━━━━━━━━━━

🕒 Created: ${this.value(new Date().toLocaleString())}
`;

    return this.send(message.trim());
  }

  // =====================================================
  // QUOTATION FOLLOW-UP
  // =====================================================

  async sendQuotationFollowup({
    customer = {},
    quotation = {},
    salesperson = {},
    reminderType = "FOLLOW_UP",
  } = {}) {
    const message = `
<b>📌 QUOTATION FOLLOW-UP</b>

━━━━━━━━━━━━━━━━━━

<b>👤 CUSTOMER</b>

Name: ${this.value(customer.name)}

Phone: ${this.value(customer.phone)}

Email: ${this.value(customer.email)}

Company: ${this.value(customer.company)}

━━━━━━━━━━━━━━━━━━

<b>📄 QUOTATION</b>

Quotation No: ${this.value(quotation.quotationNumber)}

Amount: ${this.value(quotation.amount)}

Currency: ${this.value(quotation.currency ?? "AED")}

Sent: ${
      quotation.sentAt
        ? this.value(new Date(quotation.sentAt).toLocaleString())
        : "-"
    }

━━━━━━━━━━━━━━━━━━

<b>👨‍💼 SALESPERSON</b>

${this.value(salesperson.name)}

━━━━━━━━━━━━━━━━━━

<b>⚠️ REMINDER</b>

${this.value(reminderType)}

Please contact the customer and update the quotation status.

━━━━━━━━━━━━━━━━━━

🕒 ${this.value(new Date().toLocaleString())}
`;

    return this.send(message.trim());
  }

  // =====================================================
  // CUSTOM NOTIFICATION
  // =====================================================

  async sendNotification(title, body) {
    const message = `
<b>${this.escape(title ?? "Notification")}</b>

${this.escape(body ?? "")}

🕒 ${this.value(new Date().toLocaleString())}
`;

    return this.send(message.trim());
  }

  // =====================================================
  // ERROR NOTIFICATION
  // =====================================================

  async sendError(error) {
    const errorMessage = error?.message ?? error ?? "Unknown error";

    const message = `
<b>❌ APPLICATION ERROR</b>

${this.escape(errorMessage)}

🕒 ${this.value(new Date().toLocaleString())}
`;

    return this.send(message.trim());
  }
}
