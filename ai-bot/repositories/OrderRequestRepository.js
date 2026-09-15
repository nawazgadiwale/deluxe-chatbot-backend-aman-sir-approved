import mongoose from "mongoose";
import OrderModel from "../../models/OrderRequest.js";

export default class OrderRepository {
  isConnected() {
    return Boolean(
      mongoose.connection &&
      (mongoose.connection.readyState === 1 ||
        mongoose.connection.readyState === 2),
    );
  }

  /*
   * =====================================================
   * CREATE
   * =====================================================
   */

  async create(order = {}) {
    if (!this.isConnected()) {
      return { _id: new mongoose.Types.ObjectId(), ...order };
    }
    return OrderModel.create(order);
  }

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async save(order) {
    if (!order) {
      return null;
    }
    if (!this.isConnected()) {
      return order;
    }

    order.updatedAt = new Date();

    return order.save();
  }

  /*
   * =====================================================
   * FIND BY ID
   * =====================================================
   */

  async findById(orderId) {
    if (!orderId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findById(orderId);
  }

  /*
   * =====================================================
   * FIND BY ORDER NUMBER
   * =====================================================
   */

  async findByOrderNumber(orderNumber) {
    if (!orderNumber || !this.isConnected()) {
      return null;
    }

    return OrderModel.findOne({
      orderNumber,
    });
  }

  /*
   * =====================================================
   * ACTIVE ORDER FOR SESSION
   * =====================================================
   */

  async findActiveBySession(sessionId) {
    if (!sessionId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findOne({
      sessionId,
      status: {
        $nin: ["CONFIRMED", "CANCELLED", "DELETED"],
      },
    }).sort({
      createdAt: -1,
    });
  }
  /*
   * =====================================================
   * CONVERSATION ORDER
   * =====================================================
   */

  async findByConversationId(conversationId) {
    if (!conversationId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findOne({
      conversationId,
    }).sort({
      createdAt: -1,
    });
  }

  /*
   * =====================================================
   * LEAD ORDER
   * =====================================================
   */

  async findByLeadId(leadId) {
    if (!leadId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findOne({
      leadId,
    });
  }

  /*
   * =====================================================
   * ORDER HISTORY
   * =====================================================
   */

  async findHistory(sessionId) {
    if (!sessionId || !this.isConnected()) {
      return [];
    }

    return OrderModel.find({
      sessionId,
    }).sort({
      createdAt: -1,
    });
  }

  /*
   * =====================================================
   * PENDING SALES ORDERS
   * =====================================================
   */

  async findPendingOrders() {
    if (!this.isConnected()) {
      return [];
    }

    return OrderModel.find({
      status: "CONFIRMED",

      leadId: {
        $exists: true,
      },
    }).sort({
      createdAt: -1,
    });
  }

  /*
   * =====================================================
   * UPDATE
   * =====================================================
   */

  async update(orderId, updates = {}) {
    if (!orderId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          ...updates,

          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",

        runValidators: true,
      },
    );
  }

  /*
   * =====================================================
   * ATTACH LEAD
   * =====================================================
   */

  async attachLead(orderId, leadId) {
    if (!orderId || !leadId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          leadId,

          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",

        runValidators: true,
      },
    );
  }

  /*
   * =====================================================
   * UPDATE CUSTOMER
   * =====================================================
   */

  async updateCustomer(orderId, customer = {}) {
    if (!orderId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          customer,

          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  /*
   * =====================================================
   * ATTACH LEAD + CUSTOMER
   * =====================================================
   */

  async attachLeadAndCustomer(
    orderId,
    leadId = null,
    customer = {},
  ) {
    if (!orderId || !this.isConnected()) {
      return null;
    }

    const updates = {
      updatedAt: new Date(),
    };

    if (leadId) {
      updates.leadId = leadId;
    }

    if (customer.name != null) {
      updates["customer.name"] = customer.name;
    }

    if (customer.company != null) {
      updates["customer.company"] = customer.company;
    }

    if (customer.phone != null) {
      updates["customer.phone"] = customer.phone;
    }

    if (customer.email != null) {
      updates["customer.email"] = customer.email;
    }

    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: updates,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  /*
   * =====================================================
   * UPDATE STATUS
   * =====================================================
   */

  async updateStatus(orderId, status) {
    if (!orderId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status,

          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",

        runValidators: true,
      },
    );
  }

  /*
   * =====================================================
   * SOFT DELETE
   * =====================================================
   */

  async delete(orderId) {
    if (!orderId || !this.isConnected()) {
      return null;
    }

    return OrderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: "DELETED",

          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",

        runValidators: true,
      },
    );
  }

  /*
   * =====================================================
   * SAVE DRAFT ORDER
   * =====================================================
   */

  /*
  * =====================================================
  * SAVE DRAFT ORDER
  * =====================================================
  *
  * Rules:
  * - Existing order -> update by _id only.
  * - New order -> create a new document.
  * - sessionId is NOT an order identity.
  * - Same customer/session may have multiple orders.
  */
  async saveDraft(sessionId, conversationId, order = {}) {
    if (!sessionId || !order || !this.isConnected()) {
      return null;
    }

    const now = new Date();

    /*
     * =====================================================
     * EXISTING ORDER
     * =====================================================
     */

    let leadId = order.leadId;
    if (leadId) {
      try {
        if (leadId?.buffer) {
          leadId = new mongoose.Types.ObjectId(leadId.buffer);
        } else if (typeof leadId === "string" && mongoose.Types.ObjectId.isValid(leadId)) {
          leadId = new mongoose.Types.ObjectId(leadId);
        } else if (leadId?._id && mongoose.Types.ObjectId.isValid(String(leadId._id))) {
          leadId = new mongoose.Types.ObjectId(String(leadId._id));
        }
      } catch (e) {
        // keep fallback
      }
    }

    if (order._id) {
      let orderId = order._id;
      try {
        if (orderId?.buffer) {
          orderId = new mongoose.Types.ObjectId(orderId.buffer);
        } else if (typeof orderId === "string" && mongoose.Types.ObjectId.isValid(orderId)) {
          orderId = new mongoose.Types.ObjectId(orderId);
        } else if (orderId?._id && mongoose.Types.ObjectId.isValid(String(orderId._id))) {
          orderId = new mongoose.Types.ObjectId(String(orderId._id));
        }
      } catch (e) {
        // keep fallback
      }

      return OrderModel.findByIdAndUpdate(
        orderId,
        {
          $set: {
            conversationId,
            status: order.status,
            confirmed: order.confirmed,
            customer: order.customer,
            delivery: order.delivery,
            pricing: order.pricing,
            items: order.items,
            totalItems: order.totalItems,
            totalQuantity: order.totalQuantity,
            notes: order.notes,
            leadId,
            orderNumber: order.orderNumber,
            updatedAt: now,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );
    }

    /*
     * =====================================================
     * NEW ORDER
     * =====================================================
     *
     * No _id means this is a genuinely new order.
     * Never search by phone/session and overwrite an old order.
     */
    return OrderModel.create({
      sessionId,
      conversationId,
      status: order.status ?? "DRAFT",
      confirmed: order.confirmed ?? false,
      customer: order.customer ?? null,
      delivery: order.delivery ?? null,
      pricing: order.pricing ?? null,
      items: order.items ?? [],
      totalItems: order.totalItems ?? 0,
      totalQuantity: order.totalQuantity ?? 0,
      notes: order.notes ?? [],
      leadId: leadId ?? null,
      orderNumber: order.orderNumber ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
