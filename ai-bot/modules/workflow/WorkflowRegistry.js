export default {
  greeting: {
    capability: "greeting",
    node: "GreetingNode",
    persistent: false,
  },

  // recommendation: {
  //   capability: "recommendation",
  //   node: "RecommendationNode",
  //   persistent: true,
  //   workflow: "RECOMMENDATION",
  // },

  discovery: {
    capability: "discovery",
    node: "DiscoveryNode",
    persistent: false,
  },

  product_details: {
    capability: "product_details",
    node: "ProductDetailsNode",
    persistent: false,
  },

  // comparison: {
  //   capability: "comparison",
  //   node: "ComparisonNode",
  //   persistent: false,
  // },

  faq: {
    capability: "faq",
    node: "FAQNode",
    persistent: false,
  },

  support: {
    capability: "support",
    node: "FAQNode",
    persistent: false,
  },

  lead: {
    capability: "lead",
    node: "LeadNode",
    persistent: true,
    workflow: "LEAD",
  },

  sales: {
    capability: "sales",
    node: "SalesNode",
    persistent: true,
    workflow: "SALES",
  },

  out_of_scope: {
    capability: "out_of_scope",
    node: "OutOfScopeNode",
    persistent: false,
  },
};
