import axios from "axios";

export default class TelegramService {
  constructor(config = {}) {
    this.token = config.token ?? process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = config.chatId ?? process.env.TELEGRAM_CHAT_ID;
    this.enabled =
      config.enabled ??
      (process.env.TELEGRAM_ENABLED !== "false" && !!this.token);
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

  value(value, fallback = "-") {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    return this.escape(value);
  }

  // =====================================================
  // SEND TELEGRAM MESSAGE (TRANSPORT)
  // =====================================================

  async send(message, targetChatId = null) {
    const destinationChatId = targetChatId || this.chatId;

    if (!this.enabled) {
      console.log("[Telegram] Notifications are disabled or token is missing.");
      return false;
    }

    if (!destinationChatId) {
      console.warn("[Telegram] No destination chatId provided.");
      return false;
    }

    if (!message || !message.trim()) {
      console.warn("[Telegram] Empty message.");
      return false;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          chat_id: destinationChatId,
          text: message.trim(),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      );

      console.log("[Telegram] Summary sent successfully.");
      return true;
    } catch (error) {
      console.error(
        "[Telegram] Send Error:",
        error.response?.data?.description || error.message,
      );
      return false;
    }
  }

  // =====================================================
  // FORMAT SALES SUMMARY (PRESENTATION)
  // =====================================================

  formatSalesSummary(summary = {}) {
    const customer = summary.customer ?? {};
    const product = summary.product ?? {};
    const requirements = summary.requirements ?? {};
    const pricing = summary.pricing ?? {};
    const missing = Array.isArray(summary.missingInformation)
      ? summary.missingInformation.filter(Boolean)
      : [];

    const lines = [];

    lines.push("🔔 <b>SALES SUMMARY</b>\n");

    // 👤 Customer
    lines.push("👤 <b>Customer</b>");
    lines.push(`Name: ${this.value(customer.name, "Not provided")}`);
    lines.push(`Phone: ${this.value(customer.phone, "Not provided")}`);
    if (customer.company) {
      lines.push(`Company: ${this.value(customer.company)}`);
    }
    if (customer.email) {
      lines.push(`Email: ${this.value(customer.email)}`);
    }
    lines.push("");

    // 📦 Product
    lines.push("📦 <b>Product</b>");
    const productName = product.name || product.id || "Inquiry / Custom";
    lines.push(this.value(productName));
    if (product.selectionName || product.selectionId) {
      lines.push(`Selection: ${this.value(product.selectionName || product.selectionId)}`);
    }
    lines.push("");

    // 📁 Category
    if (product.mainCategory) {
      lines.push("📁 <b>Category</b>");
      lines.push(this.value(product.mainCategory));
      lines.push("");
    }

    // 📋 Requirements
    const reqLines = [];
    if (requirements.quantity != null && requirements.quantity !== "") {
      reqLines.push(`• Quantity: ${this.value(requirements.quantity)}`);
    }
    if (requirements.numberOfNames != null && requirements.numberOfNames !== "") {
      reqLines.push(`• Names: ${this.value(requirements.numberOfNames)}`);
    }
    if (requirements.material) {
      reqLines.push(`• Material: ${this.value(requirements.material)}`);
    }
    if (requirements.lamination) {
      reqLines.push(`• Lamination: ${this.value(requirements.lamination)}`);
    }
    if (requirements.artwork) {
      reqLines.push(`• Artwork: ${this.value(requirements.artwork)}`);
    }
    if (requirements.deliveryMethod) {
      reqLines.push(`• Delivery: ${this.value(requirements.deliveryMethod)}`);
    }
    if (requirements.deliveryAddress) {
      reqLines.push(`• Address: ${this.value(requirements.deliveryAddress)}`);
    }
    if (requirements.requiredDate) {
      reqLines.push(`• Required Date: ${this.value(requirements.requiredDate)}`);
    }
    if (Array.isArray(requirements.addons) && requirements.addons.length > 0) {
      const addonNames = requirements.addons
        .map((a) => (typeof a === "object" ? a.name || a.label || a.id : a))
        .filter(Boolean)
        .join(", ");
      if (addonNames) {
        reqLines.push(`• Add-ons: ${this.value(addonNames)}`);
      }
    }

    if (reqLines.length > 0) {
      lines.push("📋 <b>Requirements</b>");
      lines.push(reqLines.join("\n"));
      lines.push("");
    }

    // 💰 Pricing
    if (pricing.total != null && pricing.total > 0) {
      lines.push("💰 <b>Pricing</b>");
      const currency = pricing.currency || "AED";
      lines.push(`Total: ${this.value(currency)} ${this.value(pricing.total)}`);
      lines.push("");
    }

    // 📝 Summary
    if (summary.summary) {
      lines.push("📝 <b>Summary</b>");
      lines.push(this.value(summary.summary));
      lines.push("");
    }

    // ⚠️ Missing Information
    if (missing.length > 0) {
      lines.push("⚠️ <b>Missing</b>");
      lines.push(missing.map((m) => `• ${this.value(m)}`).join("\n"));
      lines.push("");
    }

    // ⚡ Next Action
    if (summary.nextAction) {
      lines.push("⚡ <b>Next Action</b>");
      lines.push(this.value(summary.nextAction));
    }

    return lines.join("\n").trim();
  }

  // =====================================================
  // FORMAT SALES UPDATE
  // =====================================================

  formatSalesUpdate(update = {}) {
    const product = update.product ?? {};
    const updates = Array.isArray(update.updates)
      ? update.updates
      : Object.entries(update.changes ?? {}).map(([k, v]) => `${k}: ${v}`);

    const lines = [];

    lines.push("🔄 <b>SALES UPDATE</b>\n");

    if (product.name || product.id) {
      lines.push("📦 <b>Product</b>");
      lines.push(this.value(product.name || product.id));
      if (product.selectionName || product.selectionId) {
        lines.push(`Selection: ${this.value(product.selectionName || product.selectionId)}`);
      }
      lines.push("");
    }

    if (updates.length > 0) {
      lines.push("📋 <b>Updates</b>");
      lines.push(updates.map((u) => `• ${this.value(u)}`).join("\n"));
      lines.push("");
    }

    if (update.nextAction) {
      lines.push("⚡ <b>Next Action</b>");
      lines.push(this.value(update.nextAction));
    }

    return lines.join("\n").trim();
  }

  // =====================================================
  // SEND SALES SUMMARY
  // =====================================================

  async sendSalesSummary(summary = {}, targetChatId = null) {
    const formatted = this.formatSalesSummary(summary);
    return this.send(formatted, targetChatId);
  }

  // =====================================================
  // SEND SALES UPDATE
  // =====================================================

  async sendSalesUpdate(update = {}, targetChatId = null) {
    const formatted = this.formatSalesUpdate(update);
    return this.send(formatted, targetChatId);
  }

  // =====================================================
  // LEGACY HELPERS (PRESERVED FOR NON-SALES CALLERS)
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
Sent: ${quotation.sentAt ? this.value(new Date(quotation.sentAt).toLocaleString()) : "-"}

━━━━━━━━━━━━━━━━━━

<b>👨‍💼 SALESPERSON</b>
${this.value(salesperson.name)}

━━━━━━━━━━━━━━━━━━

<b>⚠️ REMINDER</b>
${this.value(reminderType)}
Please contact the customer and update the quotation status.
`;

    return this.send(message.trim());
  }

  async sendNotification(title, body) {
    const message = `
<b>${this.escape(title ?? "Notification")}</b>

${this.escape(body ?? "")}
`;
    return this.send(message.trim());
  }

  async sendError(error) {
    const errorMessage = error?.message ?? error ?? "Unknown error";
    const message = `
<b>❌ APPLICATION ERROR</b>

${this.escape(errorMessage)}
`;
    return this.send(message.trim());
  }
}
