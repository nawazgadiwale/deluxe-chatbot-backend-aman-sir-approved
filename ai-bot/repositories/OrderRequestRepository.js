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
   * CLEAN / SANITIZE ORDER DATA FOR PERSISTENCE
   * =====================================================
   */

  _cleanOrderForPersistence(order = {}) {
    if (!order) return {};

    const items = (Array.isArray(order.items) ? order.items : []).map((item) => {
      if (!item) return {};

      // 1. Minimal product snapshot
      const product = item.product
        ? {
            id: item.product.id ?? item.product.productId ?? item.product.slug ?? null,
            name: item.product.name ?? item.product.title ?? item.product.productName ?? null,
            slug: item.product.slug ?? null,
          }
        : null;

      // 2. Minimal selection snapshot
      const selection = item.selection
        ? {
            id: item.selection.id ?? null,
            name: item.selection.name ?? item.selection.label ?? null,
          }
        : null;

      // 3. Clean selected addons only (no catalog option lists, no descriptions, no images)
      let cleanAddons = [];
      if (Array.isArray(item.addons)) {
        cleanAddons = item.addons
          .map((a) => {
            if (typeof a === "string") return a;
            if (a && typeof a === "object") {
              const res = { id: a.id ?? a.value ?? a.name ?? null };
              if (a.name) res.name = a.name;
              if (a.price != null && (typeof a.price === "number" || typeof a.price === "object")) {
                res.price = a.price;
              }
              return res.id ? res : null;
            }
            return null;
          })
          .filter(Boolean);
      } else if (item.addons && typeof item.addons === "object") {
        const rawItems = item.addons.items ?? item.addons.selected ?? [];
        if (Array.isArray(rawItems)) {
          cleanAddons = rawItems
            .map((a) => {
              if (typeof a === "string") return a;
              if (a && typeof a === "object") {
                const res = { id: a.id ?? a.value ?? a.name ?? null };
                if (a.name) res.name = a.name;
                if (a.price != null && (typeof a.price === "number" || typeof a.price === "object")) {
                  res.price = a.price;
                }
                return res.id ? res : null;
              }
              return null;
            })
            .filter(Boolean);
        }
      }

      // 4. Clean workflow (remove empty artwork objects)
      const workflow = { ...(item.workflow ?? {}) };
      if (
        workflow.artwork &&
        !workflow.artwork.status &&
        !workflow.artwork.reference &&
        (!workflow.artwork.files || !workflow.artwork.files.length)
      ) {
        delete workflow.artwork;
      }

      // 5. Clean productData (strip images / heavy blobs)
      const rawProductData = item.formData ?? item.productData ?? {};
      const productData = { ...rawProductData };
      delete productData.image;
      delete productData.images;
      delete productData.options;

      return {
        product,
        selection,
        productData,
        requirements: Array.isArray(item.requirements) ? item.requirements : [],
        workflow,
        pricing: item.pricing ?? {},
        addons: cleanAddons,
        notes: Array.isArray(item.notes) ? item.notes : [],
        completed: item.completed ?? false,
      };
    });

    // Clean delivery
    const delivery = order.delivery
      ? {
          method: order.delivery.method ?? null,
          address: order.delivery.address ?? null,
          requiredDate: order.delivery.requiredDate ?? null,
        }
      : null;

    return {
      status: order.status ?? "COLLECTING",
      confirmed: order.confirmed ?? false,
      customer: order.customer ?? null,
      delivery,
      pricing: order.pricing ?? null,
      items,
      totalItems: items.length,
      totalQuantity: order.totalQuantity ?? items.reduce((sum, it) => sum + (Number(it.productData?.quantity ?? it.workflow?.quantity ?? 0)), 0),
      notes: Array.isArray(order.notes) ? order.notes : [],
      orderNumber: order.orderNumber ?? null,
    };
  }

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
    const cleanData = this._cleanOrderForPersistence(order);

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
            status: cleanData.status,
            confirmed: cleanData.confirmed,
            customer: cleanData.customer,
            delivery: cleanData.delivery,
            pricing: cleanData.pricing,
            items: cleanData.items,
            totalItems: cleanData.totalItems,
            totalQuantity: cleanData.totalQuantity,
            notes: cleanData.notes,
            leadId,
            orderNumber: cleanData.orderNumber,
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
      status: cleanData.status ?? "DRAFT",
      confirmed: cleanData.confirmed ?? false,
      customer: cleanData.customer ?? null,
      delivery: cleanData.delivery ?? null,
      pricing: cleanData.pricing ?? null,
      items: cleanData.items ?? [],
      totalItems: cleanData.totalItems ?? 0,
      totalQuantity: cleanData.totalQuantity ?? 0,
      notes: cleanData.notes ?? [],
      leadId: leadId ?? null,
      orderNumber: cleanData.orderNumber ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
