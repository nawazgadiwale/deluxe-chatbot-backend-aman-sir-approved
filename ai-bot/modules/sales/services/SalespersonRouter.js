export default class SalespersonRouter {
  constructor(customMapping = null, defaultChatId = null) {
    this.customMapping = customMapping;
    this.defaultChatId =
      defaultChatId ??
      process.env.TELEGRAM_DEFAULT_SALES_CHAT_ID ??
      process.env.TELEGRAM_CHAT_ID ??
      process.env.TELEGRAM_LEAD_CHAT_ID ??
      null;
  }

  // =====================================================
  // GET DEFAULT CATEGORY MAP
  // =====================================================

  getDefaultMapping() {
    return {
      "backdrops & exhibition": {
        salespersonId: "sales_exhibition",
        name: "Exhibition & Events Sales",
        telegramChatId:
          process.env.TELEGRAM_EVENT_DIGITAL_CHAT_ID ||
          process.env.TELEGRAM_SIGNAGE_CHAT_ID ||
          this.defaultChatId,
      },
      backdrops: {
        salespersonId: "sales_exhibition",
        name: "Exhibition & Events Sales",
        telegramChatId:
          process.env.TELEGRAM_EVENT_DIGITAL_CHAT_ID ||
          process.env.TELEGRAM_SIGNAGE_CHAT_ID ||
          this.defaultChatId,
      },
      standees: {
        salespersonId: "sales_exhibition",
        name: "Exhibition & Events Sales",
        telegramChatId:
          process.env.TELEGRAM_EVENT_DIGITAL_CHAT_ID ||
          process.env.TELEGRAM_SIGNAGE_CHAT_ID ||
          this.defaultChatId,
      },
      "print & marketing": {
        salespersonId: "sales_stationery",
        name: "Print & Stationery Sales",
        telegramChatId:
          process.env.TELEGRAM_STATIONERY_CHAT_ID || this.defaultChatId,
      },
      "stationery & corporate identity": {
        salespersonId: "sales_stationery",
        name: "Print & Stationery Sales",
        telegramChatId:
          process.env.TELEGRAM_STATIONERY_CHAT_ID || this.defaultChatId,
      },
      "business cards": {
        salespersonId: "sales_stationery",
        name: "Print & Stationery Sales",
        telegramChatId:
          process.env.TELEGRAM_STATIONERY_CHAT_ID || this.defaultChatId,
      },
      signage: {
        salespersonId: "sales_signage",
        name: "Signage Sales",
        telegramChatId:
          process.env.TELEGRAM_SIGNAGE_CHAT_ID || this.defaultChatId,
      },
      signages: {
        salespersonId: "sales_signage",
        name: "Signage Sales",
        telegramChatId:
          process.env.TELEGRAM_SIGNAGE_CHAT_ID || this.defaultChatId,
      },
      "store branding": {
        salespersonId: "sales_branding",
        name: "Store Branding Sales",
        telegramChatId:
          process.env.TELEGRAM_STORE_BRANDING_CHAT_ID || this.defaultChatId,
      },
      gifts: {
        salespersonId: "sales_gifts",
        name: "Corporate Gifts Sales",
        telegramChatId:
          process.env.TELEGRAM_GIFTS_CHAT_ID || this.defaultChatId,
      },
      "gift & stationery": {
        salespersonId: "sales_gifts",
        name: "Corporate Gifts Sales",
        telegramChatId:
          process.env.TELEGRAM_GIFT_STATIONERY_CHAT_ID ||
          process.env.TELEGRAM_GIFTS_CHAT_ID ||
          this.defaultChatId,
      },
      packaging: {
        salespersonId: "sales_packaging",
        name: "Packaging Sales",
        telegramChatId:
          process.env.TELEGRAM_PACKAGING_CHAT_ID || this.defaultChatId,
      },
      apparel: {
        salespersonId: "sales_apparel",
        name: "Apparel & Uniforms Sales",
        telegramChatId:
          process.env.TELEGRAM_APPAREL_CHAT_ID || this.defaultChatId,
      },
    };
  }

  // =====================================================
  // ROUTE MAIN CATEGORY TO SALESPERSON
  // =====================================================

  route(mainCategory) {
    if (!mainCategory || typeof mainCategory !== "string") {
      if (this.defaultChatId) {
        return {
          salespersonId: "sales_default",
          name: "General Sales",
          telegramChatId: this.defaultChatId,
          category: "General",
        };
      }
      return null;
    }

    const normalized = mainCategory.trim().toLowerCase();
    const map = this.customMapping || this.getDefaultMapping();

    // 1. Direct key match
    if (map[normalized]) {
      const targetChatId = map[normalized].telegramChatId || this.defaultChatId;
      if (targetChatId) {
        return {
          ...map[normalized],
          telegramChatId: targetChatId,
          category: mainCategory,
        };
      }
    }

    // 2. Partial / substring match
    for (const [key, config] of Object.entries(map)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        const targetChatId = config.telegramChatId || this.defaultChatId;
        if (targetChatId) {
          return {
            ...config,
            telegramChatId: targetChatId,
            category: mainCategory,
          };
        }
      }
    }

    // 3. Fallback if configured
    if (this.defaultChatId) {
      return {
        salespersonId: "sales_default",
        name: "General Sales",
        telegramChatId: this.defaultChatId,
        category: mainCategory,
      };
    }

    console.warn(
      `[SalespersonRouter] No salesperson route found for category: "${mainCategory}"`,
    );
    return null;
  }
}
