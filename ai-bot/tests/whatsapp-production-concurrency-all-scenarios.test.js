import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import crypto from "crypto";

import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppRealtimeService from "../modules/whatsapp/services/WhatsAppRealtimeService.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import WhatsAppFlowSubmissionService from "../modules/whatsapp/flows/WhatsAppFlowSubmissionService.js";
import AIService from "../../services/AIService.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import FAQAgent from "../ai/agents/FAQAgent.js";
import RoutingEngine from "../modules/routing/RoutingEngine.js";

const AUTHORIZED_NUMBER = "8310412768";
const AUTHORIZED_E164 = "+918310412768";
const AUTHORIZED_DIGITS = "918310412768";

// Ensure test credentials for outbound policy and flow token creation
process.env.WHAPI_TOKEN = "test-whapi-token-valid-12345";
process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_id_prod_1";
process.env.WHATSAPP_ACCESS_TOKEN = "test_valid_access_token_12345";
process.env.WHATSAPP_FLOW_TOKEN_SECRET = "test_flow_secret_12345";

describe("Production Reliability & Concurrency Comprehensive Suite (14 Scenarios)", () => {
  // Helper to build a test WhatsAppService with in-memory persistence
  function createTestHarness() {
    const memoryStore = new Map();
    let outboundCalls = [];
    let aiCalls = [];

    const mockApiService = {
      phoneNumberId: "phone_id_prod_1",
      accessToken: "test_valid_access_token_12345",
      sendMessage: async (to, message) => {
        outboundCalls.push({ to, message, timestamp: Date.now() });
        return {
          messaging_product: "whatsapp",
          contacts: [{ input: to, wa_id: to }],
          messages: [{ id: `wamid.out_${Date.now()}` }],
        };
      },
      sendTextMessage: async (to, text) => {
        outboundCalls.push({ to, message: { type: "text", text: { body: text } }, timestamp: Date.now() });
        return { messageId: `wamid.out_${Date.now()}` };
      },
      sendInteractiveButtonsMessage: async (to, text, buttons) => {
        outboundCalls.push({ to, message: { type: "interactive", text, buttons }, timestamp: Date.now() });
        return { messageId: `wamid.out_${Date.now()}` };
      },
    };

    const mockConversationRepo = {
      findBySessionId: async (sessionId) => memoryStore.get(sessionId) || null,
      findByCustomerWaId: async (customerWaId) => {
        for (const conv of memoryStore.values()) {
          if (conv.customerWaId === customerWaId) return conv;
        }
        return null;
      },
      createConversation: async (data) => {
        const conv = { ...data, messages: [] };
        memoryStore.set(data.sessionId, conv);
        return conv;
      },
      updateConversation: async (sessionId, update) => {
        const conv = memoryStore.get(sessionId) || { sessionId, messages: [] };
        Object.assign(conv, update);
        memoryStore.set(sessionId, conv);
        return conv;
      },
      addMessage: async (sessionId, msg) => {
        const conv = memoryStore.get(sessionId) || { sessionId, messages: [] };
        conv.messages.push(msg);
        memoryStore.set(sessionId, conv);
        return conv;
      },
      updateMessageStatus: async (wamid, status) => {
        for (const conv of memoryStore.values()) {
          const m = conv.messages.find((msg) => msg.whatsappMessageId === wamid);
          if (m) {
            m.status = status;
            return conv;
          }
        }
        return null;
      },
    };

    const realtimeService = new WhatsAppRealtimeService();
    const windowPolicy = new WhatsAppCustomerServiceWindowPolicy();
    const outboundPolicy = new WhatsAppOutboundPolicy({ windowPolicy });

    const mockAiService = {
      chat: async (params) => {
        aiCalls.push(params);
        return {
          sessionId: params.sessionId,
          workflow: params.workflow || "NONE",
          currentStep: params.currentStep || null,
          response: {
            message: `Response to ${params.message || params.action?.id || "request"}`,
          },
          actions: [],
          type: "text",
        };
      },
    };

    const service = new WhatsAppService(
      mockApiService,
      windowPolicy,
      outboundPolicy,
      null,
      mockConversationRepo,
      realtimeService,
      mockAiService,
    );

    return {
      service,
      memoryStore,
      outboundCalls,
      aiCalls,
      windowPolicy,
      outboundPolicy,
    };
  }

  // =========================================================================
  // SCENARIO 1: Multiple authorized requests simultaneously
  // =========================================================================
  it("Scenario 1: Multiple authorized requests executed simultaneously resolve deterministically", async () => {
    const harness = createTestHarness();

    // Fire 3 simultaneous messages from the authorized number
    const reqs = [1, 2, 3].map((i) =>
      harness.service.handleWebhook({
        object: "whatsapp_business_account",
        entry: [
          {
            id: `entry_sim_${i}`,
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "phone_id_prod_1" },
                  messages: [
                    {
                      from: AUTHORIZED_E164,
                      id: `wamid_sim_${i}`,
                      timestamp: String(Math.floor((Date.now() + i * 100) / 1000)),
                      type: "text",
                      text: { body: `Simultaneous message ${i}` },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );

    await Promise.all(reqs);

    assert.equal(harness.aiCalls.length, 3);
    assert.equal(harness.outboundCalls.length, 3);
    // All 3 requests must route to the same single authorized session
    const uniqueSessions = new Set(harness.aiCalls.map((c) => c.sessionId));
    assert.equal(uniqueSessions.size, 1);
    assert.equal([...uniqueSessions][0], `whatsapp:phone_id_prod_1:${AUTHORIZED_DIGITS}`);
  });

  // =========================================================================
  // SCENARIO 2: Rapid messages from the same authorized number (FIFO order)
  // =========================================================================
  it("Scenario 2: Rapid messages from the authorized number execute sequentially in FIFO order", async () => {
    const aiService = new AIService();
    const sessionId = `rapid_auth_test_${Date.now()}`;
    const log = [];

    // Message 1: Select product
    const p1 = aiService
      .chat({
        sessionId,
        site: "exprintmart",
        channel: "WHATSAPP",
        action: { id: "SELECT_PRODUCT", payload: { productId: "business-cards" } },
        whatsapp: { phoneNumber: AUTHORIZED_DIGITS },
      })
      .then((res) => {
        log.push({ step: 1, action: "SELECT_PRODUCT" });
        return res;
      });

    // Message 2: Order now
    const p2 = aiService
      .chat({
        sessionId,
        site: "exprintmart",
        channel: "WHATSAPP",
        action: { id: "ORDER_NOW", payload: { productId: "business-cards" } },
        whatsapp: { phoneNumber: AUTHORIZED_DIGITS },
      })
      .then((res) => {
        log.push({ step: 2, action: "ORDER_NOW" });
        return res;
      });

    // Message 3: Cancel
    const p3 = aiService
      .chat({
        sessionId,
        site: "exprintmart",
        channel: "WHATSAPP",
        message: "cancel",
        whatsapp: { phoneNumber: AUTHORIZED_DIGITS },
      })
      .then((res) => {
        log.push({ step: 3, action: "CANCEL" });
        return res;
      });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    assert.equal(log.length, 3);
    assert.equal(log[0].step, 1);
    assert.equal(log[1].step, 2);
    assert.equal(log[2].step, 3);
    assert.ok(r3.workflow === "NONE" || r3.workflow === null);
  });

  // =========================================================================
  // SCENARIO 3: Duplicate webhook
  // =========================================================================
  it("Scenario 3: Duplicate webhook events with identical messageId are ignored idempotently", async () => {
    const harness = createTestHarness();
    const duplicateMessageId = `wamid_dup_${Date.now()}`;

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_dup",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_prod_1" },
                messages: [
                  {
                    from: AUTHORIZED_E164,
                    id: duplicateMessageId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Duplicate test" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    // Dispatch payload twice concurrently
    await Promise.all([
      harness.service.handleWebhook(payload),
      harness.service.handleWebhook(payload),
    ]);

    // Exactly 1 AI execution and 1 outbound dispatch
    assert.equal(harness.aiCalls.length, 1);
    assert.equal(harness.outboundCalls.length, 1);
    assert.ok(harness.service.isDuplicateMessage(duplicateMessageId));
  });

  // =========================================================================
  // SCENARIO 4: Duplicate Flow submission
  // =========================================================================
  it("Scenario 4: Duplicate Flow submission is caught by idempotency guard and not re-executed", async () => {
    const flowService = new WhatsAppFlowSubmissionService();
    const duplicateFlowMsgId = `flow_sub_dup_${Date.now()}`;

    // Create flow token
    const token = flowService.tokenService.create({
      type: "order",
      sessionId: `whatsapp:phone_1:${AUTHORIZED_DIGITS}`,
      phoneNumber: AUTHORIZED_DIGITS,
      productId: "roll-up-banner",
      workflow: "SALES",
    });

    const flowData = {
      quantity: 1,
    };

    // First submission
    const res1 = await flowService.handleFlowSubmission({
      flowData,
      flowToken: token,
      messageId: duplicateFlowMsgId,
      customerWaId: AUTHORIZED_DIGITS,
    });

    assert.equal(res1.handled, true);
    assert.equal(res1.duplicate, undefined);

    // Second submission with same messageId
    const res2 = await flowService.handleFlowSubmission({
      flowData,
      flowToken: token,
      messageId: duplicateFlowMsgId,
      customerWaId: AUTHORIZED_DIGITS,
    });

    assert.equal(res2.handled, true);
    assert.equal(res2.duplicate, true);
  });

  // =========================================================================
  // SCENARIO 5: Cancellation followed immediately by another message
  // =========================================================================
  it("Scenario 5: Cancel -> Hi behaves normally and Cancel Business Cards -> Brochures starts cleanly", async () => {
    const salesBrain = new SalesBrain();

    // 1. Start business cards order
    const orderState = await salesBrain.execute({
      action: { id: "ORDER_NOW", payload: { productId: "business-cards" } },
      workflow: "SALES",
      currentStep: "ORDER_FORM",
      liveRequirement: { items: [{ product: { id: "business-cards", name: "Business Cards" } }] },
    });

    // 2. User cancels
    const cancelState = await salesBrain.execute({
      ...orderState,
      action: { id: "CANCEL_ORDER" },
    });

    assert.equal(cancelState.workflow, "NONE");
    assert.equal(cancelState.currentStep, null);
    assert.equal(cancelState.liveRequirement, null);
    assert.equal(cancelState.productSales, null);

    // 3. User immediately says "Hi" -> Routes to greeting cleanly
    const routingEngine = new RoutingEngine();
    const greetingRoute = await routingEngine.route({
      ...cancelState,
      userMessage: "Hi",
      action: null,
    });
    assert.equal(greetingRoute.capability, "greeting");

    // 4. User starts "Brochures" -> Starts cleanly without stale business card state
    const brochureRoute = await routingEngine.route({
      ...cancelState,
      action: { id: "SELECT_PRODUCT", payload: { productId: "brochures" } },
      userMessage: "",
    });
    assert.equal(brochureRoute.capability, "sales");
  });

  // =========================================================================
  // SCENARIO 6: FAQ during active workflow
  // =========================================================================
  it("Scenario 6: FAQ during active sales workflow does NOT overwrite or clear active state", async () => {
    const routingEngine = new RoutingEngine();

    const activeWorkflowState = {
      workflow: "SALES",
      currentStep: "ORDER_FORM",
      selectedProduct: { id: "affordable", name: "Affordable Business Cards" },
      liveRequirement: { items: [{ product: { id: "affordable" } }] },
      userMessage: "What are your business hours?",
      action: null,
    };

    const route = await routingEngine.route(activeWorkflowState);
    assert.equal(route.capability, "faq");
    // State preservation: persistent workflow remains intact
    assert.equal(activeWorkflowState.workflow, "SALES");
    assert.equal(activeWorkflowState.currentStep, "ORDER_FORM");
  });

  // =========================================================================
  // SCENARIO 7: Failed FAQ during active workflow
  // =========================================================================
  it("Scenario 7: Failed FAQ returns graceful fallback without corrupting active order state", async () => {
    const faqAgent = new FAQAgent();

    const activeState = {
      workflow: "SALES",
      currentStep: "ORDER_FORM",
      userMessage: "Do you deliver to Abu Dhabi?",
      selectedProduct: { id: "affordable" },
      transientExecution: {
        active: true,
        capability: "faq",
        persistentWorkflow: "SALES",
        persistentStep: "ORDER_FORM",
      },
    };

    const result = await faqAgent.execute(activeState);
    assert.ok(result.response);
    assert.ok(result.response.data || result.response.message || result.response.answer);
    assert.equal(activeState.workflow, "SALES");
    assert.equal(activeState.currentStep, "ORDER_FORM");
  });

  // =========================================================================
  // SCENARIO 8: Slow external API does not block other requests
  // =========================================================================
  it("Scenario 8: Slow external call on one session does not block a fast request on another session", async () => {
    const aiService = new AIService();

    const slowSession = `slow_session_${Date.now()}`;
    const fastSession = `fast_session_${Date.now()}`;

    let fastResolved = false;

    // Slow session has a simulated delay inside its handler
    const slowTask = aiService.enqueueSessionTask(slowSession, async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return "slow_done";
    });

    // Fast session runs independently
    const fastTask = aiService.enqueueSessionTask(fastSession, async () => {
      fastResolved = true;
      return "fast_done";
    });

    // Give fastTask immediate execution chance
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(fastResolved, true, "Fast session must resolve without waiting for slow session");

    const [rSlow, rFast] = await Promise.all([slowTask, fastTask]);
    assert.equal(rSlow, "slow_done");
    assert.equal(rFast, "fast_done");
  });

  // =========================================================================
  // SCENARIO 9: Database failure during conversation save
  // =========================================================================
  it("Scenario 9: Database failure during saveSession does not crash graph execution", async () => {
    const harness = createTestHarness();

    // Cause findBySessionId or update to reject with network error
    harness.service.conversationRepository.update = async () => {
      throw new Error("MongoNetworkTimeoutError: connection timed out");
    };

    // Inbound customer message arrives
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_db_fail",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_prod_1" },
                messages: [
                  {
                    from: AUTHORIZED_E164,
                    id: `wamid_db_fail_${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Testing DB failure" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    // Must not throw an unhandled rejection
    await harness.service.handleWebhook(payload);

    // AI and outbound still completed gracefully
    assert.equal(harness.aiCalls.length, 1);
    assert.equal(harness.outboundCalls.length, 1);
  });

  // =========================================================================
  // SCENARIO 10: Malformed message
  // =========================================================================
  it("Scenario 10: Malformed message is safely rejected without invoking AI", async () => {
    const harness = createTestHarness();

    await harness.service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_malformed",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_prod_1" },
                messages: [
                  {
                    from: AUTHORIZED_E164,
                    id: "wamid_malformed_1",
                    type: "unknown_weird_payload_type",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(harness.aiCalls.length, 0);
    assert.equal(harness.outboundCalls.length, 0);
  });

  // =========================================================================
  // SCENARIO 11: Unauthorized number sends message
  // =========================================================================
  it("Scenario 11: Unauthorized number is dropped at inbound gate with 0 AI and 0 outbound", async () => {
    const harness = createTestHarness();

    await harness.service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_unauth_11",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_prod_1" },
                messages: [
                  {
                    from: "+919876543210", // Unauthorized
                    id: "wamid_unauth_11",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "I want to place an order" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(harness.aiCalls.length, 0);
    assert.equal(harness.outboundCalls.length, 0);
    assert.equal(harness.memoryStore.size, 0);
  });

  // =========================================================================
  // SCENARIO 12: Multiple unauthorized numbers sent concurrently
  // =========================================================================
  it("Scenario 12: Multiple unauthorized numbers sent concurrently are all rejected", async () => {
    const harness = createTestHarness();
    const badSenders = ["+15551234567", "+447911123456", "9999999999", "+18310412768"];

    await Promise.all(
      badSenders.map((phone, idx) =>
        harness.service.handleWebhook({
          object: "whatsapp_business_account",
          entry: [
            {
              id: `entry_multi_bad_${idx}`,
              changes: [
                {
                  field: "messages",
                  value: {
                    messaging_product: "whatsapp",
                    metadata: { phone_number_id: "phone_id_prod_1" },
                    messages: [
                      {
                        from: phone,
                        id: `wamid_multi_bad_${idx}`,
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        type: "text",
                        text: { body: "Hello" },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      ),
    );

    assert.equal(harness.aiCalls.length, 0);
    assert.equal(harness.outboundCalls.length, 0);
    assert.equal(harness.memoryStore.size, 0);
  });

  // =========================================================================
  // SCENARIO 13: Missing sender number
  // =========================================================================
  it("Scenario 13: Missing sender number fails closed with no outbound response", async () => {
    const harness = createTestHarness();

    await harness.service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_missing_phone",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_prod_1" },
                messages: [
                  {
                    id: "wamid_no_from",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Missing from field" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(harness.aiCalls.length, 0);
    assert.equal(harness.outboundCalls.length, 0);
  });

  // =========================================================================
  // SCENARIO 14: Status/read webhook
  // =========================================================================
  it("Scenario 14: WhatsApp status/read events do not trigger AI replies", async () => {
    const harness = createTestHarness();

    await harness.service.handleWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_statuses",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone_id_prod_1" },
                statuses: [
                  {
                    id: "wamid_sent_123",
                    status: "sent",
                    recipient_id: AUTHORIZED_DIGITS,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                  {
                    id: "wamid_sent_123",
                    status: "delivered",
                    recipient_id: AUTHORIZED_DIGITS,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                  {
                    id: "wamid_sent_123",
                    status: "read",
                    recipient_id: AUTHORIZED_DIGITS,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(harness.aiCalls.length, 0);
    assert.equal(harness.outboundCalls.length, 0);
  });
});
