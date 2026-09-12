const BaseRepositoryModule = require("./BaseRepositories");
const ConversationModule = require("../../models/Conversation");

const BaseRepository = BaseRepositoryModule.default || BaseRepositoryModule;

const Conversation = ConversationModule.default || ConversationModule;

class ConversationRepository extends BaseRepository {
  constructor() {
    super();
    this.model = Conversation;
  }

  // =====================================================
  // FIND BY SESSION
  // =====================================================

  async findBySessionId(sessionId) {
    return this.findOne({
      sessionId,
    });
  }

  // =====================================================
  // FIND BY CUSTOMER WA ID
  // =====================================================

  async findByCustomerWaId(customerWaId) {
    if (!customerWaId) {
      return null;
    }
    return this.findOne({
      customerWaId: String(customerWaId).replace(/\D/g, ""),
      channel: "WHATSAPP",
    });
  }

  // =====================================================
  // CREATE CONVERSATION
  // =====================================================

  async createConversation({
    sessionId,
    channel = "WEB",
    customerWaId = null,
    lastUserMessageAt = null,
    lastInboundMessageId = null,
    customer = {},
    metadata = {},
  }) {
    return this.create({
      sessionId,
      channel,
      customerWaId: customerWaId ? String(customerWaId).replace(/\D/g, "") : null,
      lastUserMessageAt: lastUserMessageAt ? new Date(lastUserMessageAt) : null,
      lastInboundMessageId: lastInboundMessageId ? String(lastInboundMessageId) : null,

      customer: {
        name: customer.name ?? null,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
        company: customer.company ?? null,
      },

      messages: [],

      workflow: "NONE",

      currentStep: null,

      memory: {},

      status: "ACTIVE",

      metadata,
    });
  }

  // =====================================================
  // UPDATE CONVERSATION
  // =====================================================

  async updateConversation(sessionId, update = {}) {
    return this.update(
      { sessionId },
      {
        $set: update,
      },
    );
  }

  // =====================================================
  // ADD MESSAGE
  // =====================================================

  async addMessage(sessionId, message) {
    return this.update(
      { sessionId },
      {
        $push: {
          messages: message,
        },
      },
    );
  }

  // =====================================================
  // UPDATE MESSAGE STATUS (BY WAMID)
  // =====================================================

  async updateMessageStatus(whatsappMessageId, status) {
    if (!whatsappMessageId || !status) {
      return null;
    }

    return this.update(
      { "messages.whatsappMessageId": whatsappMessageId },
      {
        $set: {
          "messages.$.status": status,
        },
      },
    );
  }

  // =====================================================
  // COMPLETE
  // =====================================================

  async closeConversation(sessionId) {
    return this.update(
      { sessionId },
      {
        $set: {
          status: "COMPLETED",
        },
      },
    );
  }

  // =====================================================
  // ABANDON
  // =====================================================

  // =====================================================
  // VISITOR SUMMARY & PREVIOUS SESSION
  // =====================================================

  async getVisitorSummary(visitorId, site = "exprintmart") {
    if (!visitorId || !this.isConnected()) {
      return {
        totalSessions: 1,
        isReturningVisitor: false,
        isPureVisitor: true,
        isKnownCustomer: false,
        isLead: false,
        isQuotationCustomer: false,
      };
    }

    try {
      const conversations = await this.find({
        visitorId,
        site,
      });

      const totalSessions = conversations?.length || 1;
      const hasOrdered = conversations?.some?.(
        (c) => c.engagement?.hasOrdered || c.visitorType === "CUSTOMER",
      );
      const hasQuotation = conversations?.some?.(
        (c) =>
          c.engagement?.hasRequestedQuote ||
          c.requestType === "QUOTATION" ||
          c.visitorType === "QOUTATION",
      );
      const hasLead = conversations?.some?.(
        (c) => c.engagement?.hasSubmittedLead || c.visitorType === "LEAD",
      );

      return {
        totalSessions,
        isReturningVisitor: totalSessions > 1,
        isKnownCustomer: Boolean(hasOrdered),
        isQuotationCustomer: Boolean(hasQuotation),
        isLead: Boolean(hasLead),
        isPureVisitor: !hasOrdered && !hasQuotation && !hasLead,
      };
    } catch {
      return {
        totalSessions: 1,
        isReturningVisitor: false,
        isPureVisitor: true,
        isKnownCustomer: false,
        isLead: false,
        isQuotationCustomer: false,
      };
    }
  }

  async findLatestPreviousSession(
    visitorId,
    currentSessionId,
    site = "exprintmart",
  ) {
    if (!visitorId || !this.isConnected()) {
      return null;
    }

    try {
      return await this.findOne({
        visitorId,
        sessionId: { $ne: currentSessionId },
        site,
      });
    } catch {
      return null;
    }
  }
}

module.exports = ConversationRepository;
