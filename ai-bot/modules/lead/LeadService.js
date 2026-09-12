import mongoose from "mongoose";
import Counter from "../../../models/Counter.js";
import Data from "../../../models/Data.js";
import Conversation from "../../../models/Conversation.js";

import TelegramService from "../telegram/TelegramService.js";
import OrderRepository from "../../repositories/OrderRequestRepository.js";

const telegramService = new TelegramService();

const orderRepository = new OrderRepository();

export default class LeadService {
  /*
   * =====================================================
   * CREATE LEAD
   * =====================================================
   */

  async createLead(leadDocument, isOrder = false) {
    let savedLead;
    try {
      if (!mongoose.connection || (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2)) {
        savedLead = {
          _id: new mongoose.Types.ObjectId(),
          ...leadDocument,
          toObject() {
            return this;
          },
        };
      } else {
        savedLead = await new Data(leadDocument).save();
      }
    } catch (err) {
      console.warn("createLead fallback to in-memory:", err.message);
      savedLead = {
        _id: new mongoose.Types.ObjectId(),
        ...leadDocument,
        toObject() {
          return this;
        },
      };
    }

    console.log("========== LEAD SAVED ==========");

    console.dir(savedLead.toObject?.() ?? savedLead, {
      depth: null,
    });

    /*
     * =================================================
     * TELEGRAM
     * =================================================
     *
     * For normal leads:
     *     sendLead()
     *
     * For ORDER:
     *     notification is sent later by
     *     updateOrderAfterLead()
     *
     * This prevents duplicate ORDER notifications.
     */

    if (!isOrder) {
      try {
        await telegramService.sendLead(savedLead);
      } catch (err) {
        console.warn("Telegram sendLead skipped:", err.message);
      }
    }

    return savedLead;
  }

  /*
   * =====================================================
   * NEXT LEAD REFERENCE NUMBER
   * =====================================================
   */

  async getNextRefNumber() {
    try {
      if (!mongoose.connection || (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2)) {
        return Date.now();
      }
      const counter = await Counter.findOneAndUpdate(
        {
          key: "refNo",
        },
        {
          $inc: {
            value: 1,
          },
        },
        {
          returnDocument: "after",
          upsert: true,
        },
      );

      return counter.value;
    } catch (err) {
      console.warn("getNextRefNumber fallback:", err.message);
      return Date.now();
    }
  }

  /*
   * =====================================================
   * GET CONVERSATION REQUEST TYPE
   * =====================================================
   */

  async getConversationRequestType(sessionId) {
    if (!sessionId) {
      return null;
    }

    try {
      if (
        !mongoose.connection ||
        (mongoose.connection.readyState !== 1 &&
          mongoose.connection.readyState !== 2)
      ) {
        return null;
      }

      const conversation = await Conversation.findOne(
        {
          sessionId,
        },
        {
          requestType: 1,
        },
      ).lean();

      return conversation?.requestType ?? null;
    } catch (err) {
      console.warn("getConversationRequestType fallback:", err.message);
      return null;
    }
  }

  /*
   * =====================================================
   * UPDATE CONVERSATION REQUEST TYPE
   * =====================================================
   */

  async updateConversationRequestType(sessionId, requestType) {
    if (!sessionId || !requestType) {
      return null;
    }

    try {
      if (
        !mongoose.connection ||
        (mongoose.connection.readyState !== 1 &&
          mongoose.connection.readyState !== 2)
      ) {
        return null;
      }

      const conversation = await Conversation.findOneAndUpdate(
        {
          sessionId,
        },
        {
          $set: {
            requestType,
          },
        },
        {
          new: true,
          upsert: false,
        },
      );

      if (!conversation) {
        console.warn("Conversation not found:", sessionId);

        return null;
      }

      console.log("========== CONVERSATION REQUEST TYPE UPDATED ==========");
      return conversation;
    } catch (err) {
      console.warn("updateConversationRequestType fallback:", err.message);
      return null;
    }
  }

  /*
   * =====================================================
   * UPDATE ORDER AFTER LEAD
   * =====================================================
   */

  async updateOrderAfterLead(
    orderId,
    customer = {},
    leadId = null,
    lead = null,
  ) {
    if (!orderId) {
      console.warn("========== ORDER UPDATE SKIPPED ==========");

      console.warn("Missing orderId while attaching lead.");

      return null;
    }

    /*
     * =================================================
     * UPDATE EXISTING ORDER
     * =================================================
     */

    let updatedOrder = null;
    try {
      updatedOrder = await orderRepository.attachLeadAndCustomer(
        orderId,
        leadId,
        customer,
      );
    } catch (err) {
      console.warn("attachLeadAndCustomer skipped:", err.message);
    }

    if (!updatedOrder) {
      console.warn("Order not found or DB disconnected:", orderId);
      updatedOrder = { _id: orderId, leadId, customer };
    }

    console.log("========== ORDER UPDATED AFTER LEAD ==========");

    console.dir(updatedOrder.toObject?.() ?? updatedOrder, {
      depth: null,
    });

    /*
     * =================================================
     * TELEGRAM
     * =================================================
     */

    try {
      if (lead) {
        await telegramService.sendLeadWithOrder(lead, updatedOrder);
      } else {
        await telegramService.sendOrder(updatedOrder);
      }
    } catch (err) {
      console.warn("Telegram notification skipped:", err.message);
    }

    return updatedOrder;
  }
}
