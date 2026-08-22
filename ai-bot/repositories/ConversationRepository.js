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
  // CREATE CONVERSATION
  // =====================================================

  async createConversation({ sessionId, customer = {}, metadata = {} }) {
    return this.create({
      sessionId,

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

  async abandonConversation(sessionId) {
    return this.update(
      { sessionId },
      {
        $set: {
          status: "ABANDONED",
        },
      },
    );
  }
}

module.exports = ConversationRepository;
