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
    const savedLead = await new Data(leadDocument).save();

    console.log("========== LEAD SAVED ==========");

    console.dir(savedLead.toObject(), {
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
      await telegramService.sendLead(savedLead);
    }

    return savedLead;
  }

  /*
   * =====================================================
   * NEXT LEAD REFERENCE NUMBER
   * =====================================================
   */

  async getNextRefNumber() {
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

    const conversation = await Conversation.findOne(
      {
        sessionId,
      },
      {
        requestType: 1,
      },
    ).lean();

    return conversation?.requestType ?? null;
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

    console.log("Session:", sessionId);

    console.log("Request Type:", requestType);

    return conversation;
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

    const updatedOrder = await orderRepository.attachLeadAndCustomer(
      orderId,
      leadId,
      customer,
    );

    if (!updatedOrder) {
      console.warn("Order not found:", orderId);

      return null;
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

    if (lead) {
      await telegramService.sendLeadWithOrder(lead, updatedOrder);
    } else {
      await telegramService.sendOrder(updatedOrder);
    }

    return updatedOrder;
  }
}
