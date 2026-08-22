import mongoose from "mongoose";

/*
 * =====================================================
 * Product
 * =====================================================
 */

const ProductSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    slug: String,
  },
  { _id: false },
);

/*
 * =====================================================
 * Product Selection
 * =====================================================
 */

const SelectionSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
  },
  { _id: false },
);

/*
 * =====================================================
 * Product Requirement
 * =====================================================
 */

const RequirementSchema = new mongoose.Schema(
  {
    id: String,

    name: String,

    required: {
      type: Boolean,
      default: true,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    status: {
      type: String,
      enum: ["PENDING", "RECEIVED", "VERIFIED"],
      default: "PENDING",
    },
  },
  { _id: false },
);

/*
 * =====================================================
 * Workflow
 * =====================================================
 */

const WorkflowSchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      default: null,
    },

    artwork: {
      status: {
        type: String,
        enum: ["CUSTOMER_ARTWORK", "NEED_DESIGN"],
        default: null,
      },

      reference: {
        type: String,
        default: null,
      },
    },
  },
  { _id: false },
);

/*
 * =====================================================
 * Pricing
 * =====================================================
 */

const PricingSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      default: "AED",
    },

    subtotal: {
      type: Number,
      default: 0,
    },

    delivery: {
      type: Number,
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

/*
 * =====================================================
 * Delivery
 * =====================================================
 */

const DeliverySchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["delivery", "pickup"],
      default: null,
    },

    address: {
      type: String,
      default: null,
    },

    requiredDate: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

/*
 * =====================================================
 * Customer
 * =====================================================
 */

const CustomerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: null,
    },

    company: {
      type: String,
      default: null,
    },

    phone: {
      type: String,
      default: null,
    },

    email: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

/*
 * =====================================================
 * Order Item
 * =====================================================
 */

const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: ProductSchema,
      required: true,
    },

    selection: {
      type: SelectionSchema,
      default: null,
    },

    /*
     * Dynamic product fields.
     * Example:
     *
     * {
     *    numberOfNames: 3,
     *    width: 200,
     *    height: 100,
     *    lamination: "Matte"
     * }
     */
    productData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /*
     * Product specific requirements.
     *
     * Example:
     *
     * Trade License
     * Emirates ID
     * Municipality Approval
     */
    requirements: {
      type: [RequirementSchema],
      default: [],
    },

    /*
     * Common workflow fields.
     */
    workflow: {
      type: WorkflowSchema,
      default: () => ({}),
    },

    pricing: {
      type: PricingSchema,
      default: () => ({}),
    },

    addons: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    notes: {
      type: [String],
      default: [],
    },

    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

/*
 * =====================================================
 * Order
 * =====================================================
 */

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      default: null,
      sparse: true,
    },

    sessionId: {
      type: String,
      required: true,
      index: true,
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    status: {
      type: String,
      enum: ["COLLECTING", "REVIEW", "CONFIRMED", "CANCELLED", "DELETED"],
      default: "COLLECTING",
    },

    confirmed: {
      type: Boolean,
      default: false,
    },

    customer: {
      type: CustomerSchema,
      default: () => ({}),
    },

    delivery: {
      type: DeliverySchema,
      default: () => ({}),
    },

    pricing: {
      type: PricingSchema,
      default: () => ({}),
    },

    items: {
      type: [OrderItemSchema],
      default: [],
    },

    totalItems: {
      type: Number,
      default: 0,
    },

    totalQuantity: {
      type: Number,
      default: 0,
    },

    notes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "orders",
  },
);

OrderSchema.index(
  {
    sessionId: 1,
    status: 1,
  },
  {
    name: "session_status_index",
  },
);

export default mongoose.model("Order", OrderSchema);
