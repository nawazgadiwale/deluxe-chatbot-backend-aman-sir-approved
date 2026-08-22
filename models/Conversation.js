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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
