import { Annotation } from "@langchain/langgraph";

const ConversationState = Annotation.Root({
  // Session
  sessionId: Annotation({
    default: () => null,
  }),

  conversationId: Annotation({
    default: () => null,
  }),

  customerId: Annotation({
    default: () => null,
  }),

  // Current message
  userMessage: Annotation({
    default: () => "",
  }),

  action: Annotation({
    default: () => null,
  }),

  attachments: Annotation({
    default: () => [],
  }),

  liveRequirement: Annotation({
    default: () => null,
  }),

  sales: Annotation({
    default: () => null,
  }),

  assistantMessage: Annotation({
    default: () => null,
  }),

  // Conversation history
  history: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Loaded entities
  conversation: Annotation({
    default: () => null,
  }),

  customer: Annotation({
    default: () => null,
  }),

  leadRequest: Annotation({
    default: () => null,
  }),

  currentStep: Annotation({
    default: () => null,
  }),

  // Routing
  capabilities: Annotation({
    default: () => [],
  }),

  routingConfidence: Annotation({
    default: () => 0,
  }),

  // Customer extraction

  extractedCustomer: Annotation({
    default: () => ({
      name: null,

      mobile: null,

      email: null,
    }),
  }),

  // Recommendation
  recommendation: Annotation({
    default: () => null,
  }),

  recommendationContext: Annotation({
    default: () => ({
      customerType: null,
      businessType: null,
      businessGoal: null,
      requirements: null,
      originalQuery: null,
    }),
  }),

  // RAG
  rag: Annotation({
    default: () => ({
      documents: [],
      context: "",
      normalizedQuery: "",
      enrichedQuery: "",
      filters: {},
    }),
  }),

  // Final response
  response: Annotation({
    default: () => null,
  }),

  executionPlan: Annotation({
    default: () => [],
  }),

  persistence: Annotation({
    default: () => ({
      customer: {
        dirty: false,
        updatedAt: null,
      },

      conversation: {
        dirty: false,
        updatedAt: null,
      },

      leadRequest: {
        dirty: false,
        updatedAt: null,
      },

      order: {
        dirty: false,
        updatedAt: null,
      },
    }),
  }),

  order: Annotation({
    default: () => null,
  }),

  orderContext: Annotation({
    default: () => null,
  }),

  routing: Annotation({
    default: () => null,
  }),

  currentField: Annotation({
    default: () => null,
  }),

  workflowStack: Annotation({
    default: () => [],
  }),

  currentExecutionIndex: Annotation({
    default: () => 0,
  }),
  // Shared metadata
  metadata: Annotation({
    default: () => ({}),
  }),
  workflow: Annotation({
    default: () => "NONE",
  }),

  awaitingDecision: Annotation({
    default: () => false,
  }),

  pendingQuestions: Annotation({
    default: () => [],
  }),

  completedQuestions: Annotation({
    default: () => [],
  }),

  greetingCompleted: Annotation({
    default: () => false,
  }),

  capability: Annotation({
    default: () => null,
  }),

  selectedProduct: Annotation({
    default: () => null,
  }),

  comparisonProducts: Annotation({
    default: () => [],
  }),
});

export default ConversationState;
