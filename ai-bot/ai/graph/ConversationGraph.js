import { START, END } from "@langchain/langgraph";

import ConversationState from "./ConversationState.js";
import GraphBuilder from "./GraphBuilder.js";

import LoadSessionNode from "./nodes/LoadSessionNode.js";
import RoutingNode from "./nodes/RoutingNode.js";
import WorkflowNode from "./nodes/WorkflowNode.js";
import FAQNode from "./nodes/FAQNode.js";
import ResponseNode from "./nodes/ResponseNode.js";
import SaveSessionNode from "./nodes/SaveSessionNode.js";

import ConversationRouter from "./edges/ConversationRouter.js";

import LeadNode from "./nodes/LeadNode.js";
import GreetingNode from "./nodes/GreetingNode.js";
import ProductDetailsNode from "./nodes/ProductDetailsNode.js";
import DiscoveryNode from "./nodes/DiscoveryNode.js";
import OutOfScopeNode from "./nodes/OutOfScopeNode.js";
import SalesNode from "./nodes/SalesNode.js";

import DecisionTypes from "../../modules/sales/helpers/DecisionTypes.js";

// ============================================================
// NODE INSTANCES
// ============================================================

const loadSessionNode = new LoadSessionNode();

const routingNode = new RoutingNode();

const workflowNode = new WorkflowNode();

const faqNode = new FAQNode();

const responseNode = new ResponseNode();

const saveSessionNode = new SaveSessionNode();

const conversationRouter = new ConversationRouter();

const leadNode = new LeadNode();

const greetingNode = new GreetingNode();

const productDetailsNode = new ProductDetailsNode();

const discoveryNode = new DiscoveryNode();

const salesNode = new SalesNode();

const outofscopeNode = new OutOfScopeNode();

// ============================================================
// CONSTANTS
// ============================================================

const SUBMIT_LEAD = DecisionTypes.SUBMIT_LEAD ?? "SUBMIT_LEAD";

const SUBMIT_ORDER_FORM =
  DecisionTypes.SUBMIT_ORDER_FORM ?? "SUBMIT_ORDER_FORM";

// ============================================================
// SPECIAL FLOW ROUTER
// ============================================================
//
// This router exists specifically to prevent a WhatsApp Flow
// submission from falling back into normal conversational
// routing.
//
// Priority:
//
// 1. WhatsApp Lead Flow submission
// 2. Generic SUBMIT_LEAD action
// 3. WhatsApp Order Flow submission
// 4. Generic SUBMIT_ORDER_FORM action
// 5. Normal ConversationRouter
//
// ============================================================

function routeAfterWorkflow(state = {}) {
  // ----------------------------------------------------------
  // WHATSAPP LEAD FLOW
  // ----------------------------------------------------------

  if (
    state.isFlowSubmission === true &&
    (state.flowType === "LEAD_FORM" || state.flowType === "LEAD")
  ) {
    console.log("[ConversationGraph] Routing WhatsApp Lead Flow → LeadNode");

    return "LeadNode";
  }

  // ----------------------------------------------------------
  // GENERIC LEAD SUBMISSION
  // ----------------------------------------------------------

  if (state.action?.id === SUBMIT_LEAD) {
    console.log("[ConversationGraph] Routing SUBMIT_LEAD → LeadNode");

    return "LeadNode";
  }

  // ----------------------------------------------------------
  // WHATSAPP ORDER FLOW
  // ----------------------------------------------------------

  if (
    state.isFlowSubmission === true &&
    (state.flowType === "ORDER_FORM" || state.flowType === "ORDER")
  ) {
    console.log("[ConversationGraph] Routing WhatsApp Order Flow → SalesNode");

    return "SalesNode";
  }

  // ----------------------------------------------------------
  // GENERIC ORDER FORM SUBMISSION
  // ----------------------------------------------------------

  if (state.action?.id === SUBMIT_ORDER_FORM) {
    console.log("[ConversationGraph] Routing SUBMIT_ORDER_FORM → SalesNode");

    return "SalesNode";
  }

  // ----------------------------------------------------------
  // NORMAL ROUTING
  // ----------------------------------------------------------

  return conversationRouter.route(state);
}

// ============================================================
// CONTINUE ROUTER
// ============================================================
//
// After capability processing:
//
// LeadNode
// SalesNode
// FAQNode
// etc.
//
// continue() decides whether we:
//
//   → another capability
//   → ResponseNode
//
// ============================================================

function continueAfterCapability(state = {}) {
  // ----------------------------------------------------------
  // LEAD SUBMISSION COMPLETED
  // ----------------------------------------------------------

  if (
    state.leadSubmission === true ||
    (state.workflow === "LEAD" &&
      state.currentStep === "SUBMIT_LEAD" &&
      state.completed === true)
  ) {
    console.log("[ConversationGraph] Lead completed → ResponseNode");

    return "ResponseNode";
  }

  // ----------------------------------------------------------
  // NORMAL ROUTING
  // ----------------------------------------------------------

  return conversationRouter.continue(state);
}

// ============================================================
// GRAPH
// ============================================================

export default function createConversationGraph() {
  const builder = new GraphBuilder(ConversationState);

  // ==========================================================
  // REGISTER NODES
  // ==========================================================

  builder
    .addNode("LoadSessionNode", loadSessionNode.execute.bind(loadSessionNode))

    .addNode("RoutingNode", routingNode.execute.bind(routingNode))

    .addNode("WorkflowNode", workflowNode.execute.bind(workflowNode))

    // --------------------------------------------------------
    // LEAD
    // --------------------------------------------------------

    .addNode("LeadNode", leadNode.execute.bind(leadNode))

    // --------------------------------------------------------
    // SALES
    // --------------------------------------------------------

    .addNode("SalesNode", salesNode.execute.bind(salesNode))

    // --------------------------------------------------------
    // OTHER CAPABILITIES
    // --------------------------------------------------------

    .addNode("FAQNode", faqNode.execute.bind(faqNode))

    .addNode("GreetingNode", greetingNode.execute.bind(greetingNode))

    .addNode(
      "ProductDetailsNode",
      productDetailsNode.execute.bind(productDetailsNode),
    )

    .addNode("DiscoveryNode", discoveryNode.execute.bind(discoveryNode))

    .addNode("OutOfScopeNode", outofscopeNode.execute.bind(outofscopeNode))

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    .addNode("ResponseNode", responseNode.execute.bind(responseNode))

    // --------------------------------------------------------
    // PERSISTENCE
    // --------------------------------------------------------

    .addNode("SaveSessionNode", saveSessionNode.execute.bind(saveSessionNode));

  // ==========================================================
  // STATIC EDGES
  // ==========================================================

  builder
    .addEdge(START, "LoadSessionNode")

    .addEdge("LoadSessionNode", "RoutingNode")

    .addEdge("RoutingNode", "WorkflowNode");

  // ==========================================================
  // WORKFLOW ROUTING
  // ==========================================================
  //
  // IMPORTANT:
  //
  // We DO NOT directly use:
  //
  // conversationRouter.route
  //
  // anymore.
  //
  // We first check for WhatsApp Flow submissions.
  //
  // ==========================================================

  builder.addConditionalEdges("WorkflowNode", routeAfterWorkflow);

  // ==========================================================
  // CAPABILITY NODES
  // ==========================================================

  const capabilityNodes = [
    "ProductDetailsNode",
    "LeadNode",
    "FAQNode",
    "GreetingNode",
    "DiscoveryNode",
    "SalesNode",
    "OutOfScopeNode",
  ];

  capabilityNodes.forEach((node) => {
    builder.addConditionalEdges(node, continueAfterCapability);
  });

  // ==========================================================
  // RESPONSE → SAVE
  // ==========================================================

  builder.addEdge("ResponseNode", "SaveSessionNode");

  // ==========================================================
  // SAVE → END
  // ==========================================================

  builder.addEdge("SaveSessionNode", END);

  // ==========================================================
  // COMPILE
  // ==========================================================

  return builder.compile();
}
