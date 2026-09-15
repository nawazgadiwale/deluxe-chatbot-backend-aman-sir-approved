import TelegramService from "../../telegram/TelegramService.js";
import SalespersonRouter from "./SalespersonRouter.js";
import SalesSummaryService from "./SalesSummaryService.js";

export default class SalesHandoffService {
  constructor({
    telegramService = null,
    salespersonRouter = null,
    salesSummaryService = null,
  } = {}) {
    this.telegramService = telegramService || new TelegramService();
    this.salespersonRouter =
      salespersonRouter ||
      new SalespersonRouter(null, this.telegramService.chatId);
    this.summaryService = salesSummaryService || new SalesSummaryService();

    // Idempotency store: key -> { timestamp, sentAt }
    this.deliveredEvents = new Map();
  }

  // =====================================================
  // IDEMPOTENCY KEY
  // =====================================================

  buildIdempotencyKey(state = {}, eventType = "SALES_HANDOFF", version = "v1") {
    const sessionKey =
      state.sessionId ||
      state.conversationId ||
      state.visitorId ||
      state.customer?.phone ||
      state.whatsapp?.phoneNumber ||
      "global";

    const orderId =
      state.order?.orderNumber ||
      state.order?._id ||
      state.order?.id ||
      state.liveRequirement?.orderNumber ||
      version;

    return `sales-summary:${sessionKey}:${eventType}:${orderId}`;
  }

  // =====================================================
  // TRIGGER SALES HANDOFF SUMMARY
  // =====================================================

  async triggerHandoff(state = {}, eventType = "SALES_HANDOFF", options = {}) {
    try {
      const idempotencyKey =
        options.idempotencyKey ||
        this.buildIdempotencyKey(state, eventType, options.version);

      // Check for duplicate delivery
      if (this.deliveredEvents.has(idempotencyKey)) {
        console.log(
          `[SalesHandoffService] Duplicate handoff event suppressed: ${idempotencyKey}`,
        );
        return {
          sent: false,
          duplicate: true,
          reason: "ALREADY_DELIVERED",
          idempotencyKey,
        };
      }

      // Check if Telegram notifications are enabled
      if (!this.telegramService.enabled) {
        console.log(
          "[SalesHandoffService] Telegram notifications disabled. Skipping send.",
        );
        return {
          sent: false,
          reason: "TELEGRAM_DISABLED",
          idempotencyKey,
        };
      }

      // Build structured summary
      const summary = this.summaryService.buildSummary(state, options);

      // Route to salesperson based on catalog category
      const route = this.salespersonRouter.route(summary.product?.mainCategory);

      if (!route || !route.telegramChatId) {
        console.warn(
          `[SalesHandoffService] No routing found for category: "${summary.product?.mainCategory}"`,
        );
        return {
          sent: false,
          reason: "NO_ROUTING",
          category: summary.product?.mainCategory,
          summary,
        };
      }

      // Send structured summary to Telegram
      const success = await this.telegramService.sendSalesSummary(
        summary,
        route.telegramChatId,
      );

      if (success) {
        // Record successful delivery for idempotency
        this.deliveredEvents.set(idempotencyKey, {
          timestamp: Date.now(),
          salespersonId: route.salespersonId,
        });

        console.log(
          `[SalesHandoffService] Summary delivered to ${route.salespersonId} (${route.category}) [key: ${idempotencyKey}]`,
        );

        return {
          sent: true,
          duplicate: false,
          recipient: route.salespersonId,
          category: route.category,
          idempotencyKey,
          summary,
        };
      }

      console.warn(
        `[SalesHandoffService] Telegram dispatch failed for [key: ${idempotencyKey}]`,
      );

      return {
        sent: false,
        reason: "DISPATCH_FAILED",
        idempotencyKey,
        summary,
      };
    } catch (err) {
      console.error(
        "[SalesHandoffService] Error during handoff processing:",
        err.message,
      );
      return {
        sent: false,
        error: err.message,
      };
    }
  }

  // =====================================================
  // TRIGGER SALES UPDATE
  // =====================================================

  async triggerUpdate(state = {}, updates = {}, options = {}) {
    try {
      if (!this.telegramService.enabled) {
        return { sent: false, reason: "TELEGRAM_DISABLED" };
      }

      const summary = this.summaryService.buildSummary(state, options);
      const route = this.salespersonRouter.route(summary.product?.mainCategory);

      if (!route || !route.telegramChatId) {
        return { sent: false, reason: "NO_ROUTING" };
      }

      const updatePayload = {
        product: summary.product,
        updates: Array.isArray(updates) ? updates : Object.entries(updates).map(([k, v]) => `${k}: ${v}`),
        nextAction: options.nextAction || "Reconfirm requirements with customer.",
      };

      const success = await this.telegramService.sendSalesUpdate(
        updatePayload,
        route.telegramChatId,
      );

      return {
        sent: success,
        recipient: route.salespersonId,
      };
    } catch (err) {
      console.error(
        "[SalesHandoffService] Error during update processing:",
        err.message,
      );
      return { sent: false, error: err.message };
    }
  }
}
