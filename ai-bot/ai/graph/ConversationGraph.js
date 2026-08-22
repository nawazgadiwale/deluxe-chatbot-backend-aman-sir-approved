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
const salesNode = new SalesNode();


const discoveryNode = new DiscoveryNode();
const outofscopeNode = new OutOfScopeNode();

export default function createConversationGraph() {
  const builder = new GraphBuilder(ConversationState);

  // -------------------------
  // Register Nodes
  // -------------------------

  builder
    .addNode("LoadSessionNode", loadSessionNode.execute.bind(loadSessionNode))

    .addNode("RoutingNode", routingNode.execute.bind(routingNode))

    .addNode("WorkflowNode", workflowNode.execute.bind(workflowNode))


    .addNode("LeadNode", leadNode.execute.bind(leadNode))

    .addNode("FAQNode", faqNode.execute.bind(faqNode))

    .addNode("ResponseNode", responseNode.execute.bind(responseNode))

    .addNode("SaveSessionNode", saveSessionNode.execute.bind(saveSessionNode))

    .addNode("GreetingNode", greetingNode.execute.bind(greetingNode))

    .addNode(
      "ProductDetailsNode",
      productDetailsNode.execute.bind(productDetailsNode),
    )

    .addNode("DiscoveryNode", discoveryNode.execute.bind(discoveryNode))

    .addNode("SalesNode", salesNode.execute.bind(salesNode))

    .addNode("OutOfScopeNode", outofscopeNode.execute.bind(outofscopeNode));

  // -------------------------
  // Static Edges
  // -------------------------

  builder
    .addEdge(START, "LoadSessionNode")

    .addEdge("LoadSessionNode", "RoutingNode")

    .addEdge("RoutingNode", "WorkflowNode");

  // -------------------------
  // Workflow Router
  // -------------------------

  builder.addConditionalEdges(
    "WorkflowNode",
    conversationRouter.route.bind(conversationRouter),
  );

  // -------------------------
  // Capability Nodes
  // -------------------------

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
    builder.addConditionalEdges(
      node,
      conversationRouter.continue.bind(conversationRouter),
    );
  });

  // -------------------------
  // Finish Workflow
  // -------------------------

  builder
    .addEdge("ResponseNode", "SaveSessionNode")

    .addEdge("SaveSessionNode", END);

  return builder.compile();
}
