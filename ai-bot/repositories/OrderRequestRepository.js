import OrderModel from "../../models/OrderRequest.js";

export default class OrderRepository {
  /*
   * =====================================================
   * CREATE
   * =====================================================
   */

  async create(order = {}) {
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

    order.updatedAt = new Date();

    return order.save();
  }

  /*
   * =====================================================
   * FIND BY ID
   * =====================================================
   */

  async findById(orderId) {
    if (!orderId) {
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
    if (!orderNumber) {
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
    if (!sessionId) {
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
    if (!conversationId) {
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
    if (!leadId) {
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
    if (!sessionId) {
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
    if (!orderId) {
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
    if (!orderId || !leadId) {
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
    if (!orderId) {
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

  async attachLeadAndCustomer(orderId, leadId = null, customer = {}) {
    if (!orderId) {
      return null;
    }

    const updates = {
      customer,

      updatedAt: new Date(),
    };

    if (leadId) {
      updates.leadId = leadId;
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
    if (!orderId) {
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
    if (!orderId) {
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

  async saveDraft(sessionId, conversationId, order = {}) {
    if (!sessionId || !order) {
      return null;
    }

    const update = {
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

      leadId: order.leadId,

      orderNumber: order.orderNumber,

      updatedAt: new Date(),
    };

    const doc = await OrderModel.findOneAndUpdate(
      {
        sessionId,
      },
      {
        $set: update,

        $setOnInsert: {
          sessionId,
        },
      },
      {
        upsert: true,

        returnDocument: "after",

        runValidators: true,
      },
    );

    return doc;
  }
}
