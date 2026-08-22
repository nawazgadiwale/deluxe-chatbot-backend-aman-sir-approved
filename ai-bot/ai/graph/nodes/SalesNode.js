// ai/graph/nodes/SalesNode.js

import SalesService from "../../../modules/sales/SalesService.js";
import ResponseBuilder from "../../../core/responses/Apiresponse.js";
import OrderManager from "../../../modules/sales/services/OrderManager.js";
import LeadAgent from "../../agents/LeadAgent.js";

const salesService = new SalesService();

const responseBuilder = new ResponseBuilder();

const orderManager = new OrderManager();

const leadAgent = new LeadAgent();

export default class SalesNode {
  async execute(state = {}) {
    console.log("========== SALES NODE ==========");

    const result = await salesService.execute(state);

    /*
     * =====================================================
     * Build / Update Runtime Order
     * =====================================================
     */

    let order = orderManager.buildOrder(result.liveRequirement, state.order);

    /*
     * =====================================================
     * Customer Completed Entire Order
     * =====================================================
     */

    if (result.completed) {
      order = orderManager.confirmOrder(order);
    }

    /*
     * =====================================================
     * Response
     * =====================================================
     */

    const response = result.completed
      ? responseBuilder.salesCompleted(result, result.metadata ?? {})
      : responseBuilder.sales(result, result.metadata ?? {});

    /*
     * =====================================================
     * Next State
     * =====================================================
     */

    const nextState = {
      ...state,

      assistantMessage: result.message,

      liveRequirement: result.liveRequirement,

      productSales: result.liveRequirement,

      sales: result,

      response,

      workflow: result.workflow ?? "SALES",

      currentStep: result.currentStep,

      order,

      orderContext: order,
    };

    /*
     * =====================================================
     * Persistence
     * =====================================================
     */

    if (nextState.persistence) {
      nextState.persistence.conversation.dirty = true;

      nextState.persistence.conversation.updatedAt = new Date();

      nextState.persistence.order.dirty = true;

      nextState.persistence.order.updatedAt = new Date();
    }

    /*
     * =====================================================
     * SALES → LEAD
     * =====================================================
     */

    if (result.completed && result.workflow === "LEAD") {
      console.log("========== SALES -> LEAD ==========");

      nextState.workflow = "LEAD";

      /*
       * IMPORTANT:
       *
       * The lead is NOT completed yet.
       *
       * We are asking the frontend
       * to display the customer form.
       */

      nextState.currentStep = "COLLECT_CUSTOMER";

      nextState.awaitingDecision = true;

      /*
       * LeadAgent returns the form.
       */

      return await leadAgent.execute(nextState);
    }

    return nextState;
  }
}
