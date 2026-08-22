import { StateGraph } from "@langchain/langgraph";

export default class GraphBuilder {
  constructor(stateSchema) {
    this.graph = new StateGraph(stateSchema);
  }

  addNode(name, node) {
    this.graph.addNode(name, node);
    return this;
  }

  addEdge(from, to) {
    this.graph.addEdge(from, to);
    return this;
  }

  addConditionalEdges(from, router) {
    this.graph.addConditionalEdges(from, router);
    return this;
  }

  compile() {
    return this.graph.compile();
  }
}
