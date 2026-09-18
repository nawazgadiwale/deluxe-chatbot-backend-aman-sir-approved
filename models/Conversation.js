import mongoose from "mongoose";
import crypto from "crypto";

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      default: () => crypto.randomUUID(),
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },

    // WhatsApp metadata
    whatsappMessageId: {
      type: String,
      default: null,
      index: true,
    },

    direction: {
      type: String,
      enum: ["inbound", "outbound", null],
      default: null,
    },

    senderType: {
      type: String,
      enum: ["customer", "ai", "agent", "system", null],
      default: null,
    },

    messageType: {
      type: String,
      default: "text",
    },

    status: {
      type: String,
      enum: ["received", "sent", "delivered", "read", "failed", null],
      default: null,
    },

    mediaId: {
      type: String,
      default: null,
    },

    interactiveData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    flowData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    company: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const conversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    channel: {
      type: String,
      enum: ["WEB", "WHATSAPP"],
      default: "WEB",
      index: true,
    },

    customerWaId: {
      type: String,
      default: null,
      index: true,
    },

    lastUserMessageAt: {
      type: Date,
      default: null,
    },

    lastInboundMessageId: {
      type: String,
      default: null,
    },

    customer: {
      type: customerSchema,
      default: () => ({}),
    },

    /*
     * =====================================================
     * REQUEST TYPE
     * =====================================================
     *
     * Conversation-level information.
     *
     * This does NOT belong in the CRM Data document.
     */
    requestType: {
      type: String,
      enum: ["ORDER", "QUOTATION", "EXPERT", "CONTACT_SALES"],
      default: null,
    },

    messages: {
      type: [messageSchema],
      default: [],
    },

    workflow: {
      type: String,
      default: null,
    },

    currentStep: {
      type: String,
      default: null,
    },

    memory: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "ABANDONED"],
      default: "ACTIVE",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    visitorId: {
      type: String,
      default: null,
      index: true,
    },

    site: {
      type: String,
      default: "exprintmart",
      index: true,
    },

    visitorType: {
      type: String,
      enum: ["VISITOR", "CUSTOMER", "LEAD", "QUOTATION", "QOUTATION"],
      default: "VISITOR",
    },

    previousSessionId: {
      type: String,
      default: null,
    },

    totalSessions: {
      type: Number,
      default: 1,
    },

    isReturningVisitor: {
      type: Boolean,
      default: false,
    },

    isPureVisitor: {
      type: Boolean,
      default: true,
    },

    isKnownCustomer: {
      type: Boolean,
      default: false,
    },

    isLead: {
      type: Boolean,
      default: false,
    },

    isQuotationCustomer: {
      type: Boolean,
      default: false,
    },

    visitorContext: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    engagement: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
