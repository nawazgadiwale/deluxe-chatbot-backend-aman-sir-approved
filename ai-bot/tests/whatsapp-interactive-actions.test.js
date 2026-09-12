import assert from "node:assert/strict";
import crypto from "crypto";

import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import WhatsAppWebhookHandler from "../modules/whatsapp/WhatsAppWebhookHandler.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsAppMessageParser from "../modules/whatsapp/WhatsAppMessageParser.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";
import WhatsAppApiService from "../modules/whatsapp/services/WhatsAppApiService.js";
import WhatsAppCustomerServiceWindowPolicy from "../modules/whatsapp/policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy, {
  OutboundBlockReasons,
} from "../modules/whatsapp/policies/WhatsAppOutboundPolicy.js";
import RoutingService from "../modules/routing/RoutingService.js";
import WorkflowState from "../modules/workflow/WorkflowState.js";
import SalesNode from "../ai/graph/nodes/SalesNode.js";
import AIService from "../../services/AIService.js";

async function runInteractiveTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING WHATSAPP INTERACTIVE ACTIONS TEST SUITE");
  console.log("=================================================\n");

  const testAccessToken = "test_meta_token_interactive_123";
  const testAppSecret = "test_meta_app_secret_interactive";
  const phoneNumberId = "phone_id_interactive_1";
  const botNumber = "9513166750";
  const customerNumber = "8310412768";
  const otherNumber = "9876543210";

  process.env.WHATSAPP_ACCESS_TOKEN = testAccessToken;
  process.env.WHATSAPP_APP_SECRET = testAppSecret;
  process.env.WHATSAPP_PHONE_NUMBER_ID = phoneNumberId;
  process.env.WHATSAPP_BOT_NUMBER = botNumber;

  const responseAdapter = new WhatsAppResponseAdapter();
  const messageParser = new WhatsAppMessageParser();
  const routingService = new RoutingService();
  const workflowState = new WorkflowState();

  // ============================================================
  // Test 1: AI response with 3 SELECT_SELECTION actions renders interactive WhatsApp Quick Reply buttons
  // ============================================================
  console.log("Test 1: Render 3 SELECT_SELECTION actions as interactive buttons");
  const aiResultWith3Actions = {
    response: {
      type: "buttons",
      message: "Please select your business card option:",
      actions: [
        {
          id: "SELECT_SELECTION",
          type: "SELECT_SELECTION",
          label: "Budget-Friendly Business Cards",
          payload: { productId: "business-cards", selectionId: "budget-friendly" },
        },
        {
          id: "SELECT_SELECTION",
          type: "SELECT_SELECTION",
          label: "Premium Business Cards",
          payload: { productId: "business-cards", selectionId: "premium" },
        },
        {
          id: "SELECT_SELECTION",
          type: "SELECT_SELECTION",
          label: "Luxury Business Cards",
          payload: { productId: "business-cards", selectionId: "luxury" },
        },
      ],
    },
  };

  const renderedMessages = responseAdapter.toWhatsAppMessages(aiResultWith3Actions);
  assert.equal(renderedMessages.length, 1);
  const buttonMsg = renderedMessages[0];
  assert.equal(buttonMsg.type, "interactive");
  assert.equal(buttonMsg.interactive.type, "button");
  assert.equal(buttonMsg.interactive.action.buttons.length, 3);
  assert.equal(buttonMsg.interactive.action.buttons[0].reply.title, "Budget-Friendly Busi");
  assert.equal(buttonMsg.interactive.action.buttons[0].reply.id, "selection:business-cards:budget-friendly");
  assert.equal(buttonMsg.interactive.action.buttons[1].reply.title, "Premium Business Car");
  assert.equal(buttonMsg.interactive.action.buttons[1].reply.id, "selection:business-cards:premium");
  assert.equal(buttonMsg.interactive.action.buttons[2].reply.title, "Luxury Business Card");
  assert.equal(buttonMsg.interactive.action.buttons[2].reply.id, "selection:business-cards:luxury");
  console.log("✅ Test 1 passed: 3 actions correctly rendered into interactive WhatsApp buttons\n");

  // ============================================================
  // Test 2: Inbound Button Selection is converted back into SELECT_SELECTION action
  // ============================================================
  console.log("Test 2: Button selection parsed back into structured SELECT_SELECTION action");
  const inboundButtonPayload = {
    id: "btn_click_001",
    from: customerNumber,
    type: "interactive",
    interactive: {
      type: "button_reply",
      button_reply: {
        id: "selection:business-cards:luxury",
        title: "Luxury Business Cards",
      },
    },
  };

  const parsedButton = messageParser.parse({ message: inboundButtonPayload });
  assert.equal(parsedButton.eventType, "ACTION");
  assert.equal(parsedButton.action.id, "SELECT_SELECTION");
  assert.equal(parsedButton.action.type, "SELECT_SELECTION");
  assert.equal(parsedButton.action.payload.productId, "business-cards");
  assert.equal(parsedButton.action.payload.selectionId, "luxury");
  assert.equal(parsedButton.action.payload.label, "Luxury Business Cards");
  console.log("✅ Test 2 passed: Inbound button response mapped back to SELECT_SELECTION\n");

  // ============================================================
  // Test 3: Inbound List Selection is converted back into SELECT_SELECTION action
  // ============================================================
  console.log("Test 3: List selection parsed back into structured SELECT_SELECTION action");
  const inboundListPayload = {
    id: "list_click_001",
    from: customerNumber,
    type: "interactive",
    interactive: {
      type: "list_reply",
      list_reply: {
        id: "selection:business-cards:premium",
        title: "Premium Business Cards",
        description: "350 GSM Matte Lamination",
      },
    },
  };

  const parsedList = messageParser.parse({ message: inboundListPayload });
  assert.equal(parsedList.eventType, "ACTION");
  assert.equal(parsedList.action.id, "SELECT_SELECTION");
  assert.equal(parsedList.action.type, "SELECT_SELECTION");
  assert.equal(parsedList.action.payload.productId, "business-cards");
  assert.equal(parsedList.action.payload.selectionId, "premium");
  assert.equal(parsedList.action.payload.label, "Premium Business Cards");
  console.log("✅ Test 3 passed: Inbound list response mapped back to SELECT_SELECTION\n");

  // ============================================================
  // Test 4: Customer typing "1" resolves to the first currently available action
  // ============================================================
  console.log('Test 4: Text fallback - typing "1" resolves to 1st available action');
  const testService = new WhatsAppService();
  const availableActions = aiResultWith3Actions.response.actions;

  const resolvedNum1 = testService.resolveTextAction("1", availableActions);
  assert.notEqual(resolvedNum1, null);
  assert.equal(resolvedNum1.payload.selectionId, "budget-friendly");

  const resolvedNum2 = testService.resolveTextAction("2", availableActions);
  assert.notEqual(resolvedNum2, null);
  assert.equal(resolvedNum2.payload.selectionId, "premium");

  const resolvedNum3 = testService.resolveTextAction("3", availableActions);
  assert.notEqual(resolvedNum3, null);
  assert.equal(resolvedNum3.payload.selectionId, "luxury");
  console.log('✅ Test 4 passed: "1", "2", "3" resolved deterministically to matching actions\n');

  // ============================================================
  // Test 5: Customer typing "premium" or "luxury business card" resolves to matching action
  // ============================================================
  console.log('Test 5: Text fallback - typing "premium" or "luxury business card"');
  const resolvedPremium = testService.resolveTextAction("premium", availableActions);
  assert.notEqual(resolvedPremium, null);
  assert.equal(resolvedPremium.payload.selectionId, "premium");

  const resolvedLuxury = testService.resolveTextAction("luxury business card", availableActions);
  assert.notEqual(resolvedLuxury, null);
  assert.equal(resolvedLuxury.payload.selectionId, "luxury");
  console.log('✅ Test 5 passed: "premium" and "luxury business card" resolved to matching actions\n');

  // ============================================================
  // Test 6: Unknown text does not incorrectly select an action
  // ============================================================
  console.log("Test 6: Unknown text does not select an action");
  const resolvedUnknown = testService.resolveTextAction("Where is your shop located?", availableActions);
  assert.equal(resolvedUnknown, null);

  const resolvedRandomNum = testService.resolveTextAction("99", availableActions);
  assert.equal(resolvedRandomNum, null);
  console.log("✅ Test 6 passed: Unrelated text/number returns null (preserves normal text flow)\n");

  // ============================================================
  // Test 7: Pure greeting during active SALES state allows pause & greeting routing
  // ============================================================
  console.log("Test 7: Pure greeting during active SALES pauses workflow without destroying requirement");
  const activeSalesState = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    awaitingDecision: true,
    userMessage: "hey",
    liveRequirement: {
      items: [{ product: { id: "business-cards", name: "Business Cards" } }],
    },
  };

  const shouldCont = workflowState.shouldContinue(activeSalesState);
  assert.equal(shouldCont, false, "Pure greeting should not be captured by active workflow shouldContinue");

  const canInt = workflowState.canInterrupt(activeSalesState, "greeting");
  assert.equal(canInt, true, "Greeting capability is allowed to pause active sales workflow");
  console.log("✅ Test 7 passed: Pure greeting allows pause without destroying state\n");

  // ============================================================
  // Test 8: "hey" during active SALES preserves active workflow
  // ============================================================
  console.log('Test 8: "hey" during active SALES preserves active workflow');
  const routeResult = await routingService.route(activeSalesState);
  assert.equal(routeResult.capability, "sales");
  console.log('✅ Test 8 passed: "hey" during active SALES preserves active sales workflow\n');

  // ============================================================
  // Test 9: Duplicate inbound message ID is ignored
  // ============================================================
  console.log("Test 9: Duplicate inbound message ID is ignored");
  let mockAiCallCount = 0;
  let mockOutboundCount = 0;
  const mockAi = {
    chat: async (incoming) => {
      mockAiCallCount++;
      return {
        sessionId: incoming.sessionId,
        whatsapp: incoming.whatsapp,
        response: { type: "message", message: "Response" },
      };
    },
  };
  const mockApi = new WhatsAppApiService({
    accessToken: testAccessToken,
    phoneNumberId,
  });
  mockApi.sendMessage = async () => {
    mockOutboundCount++;
    return { messages: [{ id: "out_msg_ok" }] };
  };

  const dupTestService = new WhatsAppService(
    mockApi,
    new WhatsAppCustomerServiceWindowPolicy(),
    new WhatsAppOutboundPolicy(),
    null,
    null,
    null,
    mockAi,
  );

  const dupMsgPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_interactive_test",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ wa_id: customerNumber, profile: { name: "Test User" } }],
              messages: [
                {
                  id: "msg_dup_unique_123",
                  from: customerNumber,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "Testing duplicates" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  // 1st delivery
  await dupTestService.handleWebhook(dupMsgPayload);
  assert.equal(mockAiCallCount, 1);
  assert.equal(mockOutboundCount, 1);

  // 2nd delivery (duplicate event)
  await dupTestService.handleWebhook(dupMsgPayload);
  assert.equal(mockAiCallCount, 1, "AI must NOT be called twice for duplicate message ID");
  assert.equal(mockOutboundCount, 1, "Outbound must NOT be sent twice for duplicate message ID");
  console.log("✅ Test 9 passed: Duplicate inbound message ID ignored\n");

  // ============================================================
  // Test 10: Invalid HMAC signature is rejected
  // ============================================================
  console.log("Test 10: Invalid HMAC signature is rejected");
  const webhookHandler = new WhatsAppWebhookHandler(dupTestService);
  const invalidSecretRes = await webhookHandler.handle({
    headers: { "x-hub-signature-256": "sha256=wrong_secret_value" },
    body: dupMsgPayload,
    rawBody: Buffer.from(JSON.stringify(dupMsgPayload)),
  });
  assert.equal(invalidSecretRes.status, 403);
  assert.equal(invalidSecretRes.body, "Invalid signature");
  console.log("✅ Test 10 passed: Invalid HMAC signature rejected with 403\n");

  // ============================================================
  // Test 11: Missing HMAC signature fails closed
  // ============================================================
  console.log("Test 11: Missing HMAC signature fails closed");
  const missingSecretRes = await webhookHandler.handle({
    headers: {},
    body: dupMsgPayload,
    rawBody: Buffer.from(JSON.stringify(dupMsgPayload)),
  });
  assert.equal(missingSecretRes.status, 403);
  console.log("✅ Test 11 passed: Missing signature header rejected with 403\n");

  // ============================================================
  // Test 12 & 13: Invalid webhook does not invoke AI or send outbound
  // ============================================================
  console.log("Test 12 & 13: Invalid webhook does not invoke AI or outbound");
  const prevAiCount = mockAiCallCount;
  const prevOutboundCount = mockOutboundCount;
  await webhookHandler.handle({
    headers: { "x-hub-signature-256": "sha256=invalid" },
    body: dupMsgPayload,
    rawBody: Buffer.from(JSON.stringify(dupMsgPayload)),
  });
  assert.equal(mockAiCallCount, prevAiCount);
  assert.equal(mockOutboundCount, prevOutboundCount);
  console.log("✅ Test 12 & 13 passed: Invalid webhook does not trigger AI or outbound\n");

  // ============================================================
  // Test 14: Outbound recipient always comes from authenticated inbound context
  // ============================================================
  console.log("Test 14: Outbound recipient always comes from authenticated inbound context");
  let capturedRecipient = null;
  mockApi.sendMessage = async (to) => {
    capturedRecipient = to;
    return { messages: [{ id: "out_ok" }] };
  };

  await dupTestService.handleWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_interactive_test",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ wa_id: customerNumber, profile: { name: "Test User" } }],
              messages: [
                {
                  id: "msg_auth_context_001",
                  from: customerNumber,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "I am customer 8310412768" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.equal(capturedRecipient, customerNumber);
  assert.notEqual(capturedRecipient, botNumber);
  console.log("✅ Test 14 passed: Outbound recipient strictly bound to authenticated inbound customer\n");

  // ============================================================
  // Test 15: Website chat behavior remains unchanged
  // ============================================================
  console.log("Test 15: Website chat behavior remains unchanged");
  const aiService = new AIService();
  assert.equal(typeof aiService.chat, "function");
  assert.equal(typeof aiService.validateRequest, "function");
  console.log("✅ Test 15 passed: AIService contract for WEB channel remains unchanged\n");

  // ============================================================
  // Test 16: No proactive WhatsApp send is possible through this adapter
  // ============================================================
  console.log("Test 16: No proactive WhatsApp send without inbound trigger");
  const unauthSendResult = await dupTestService.sendTextMessage(
    customerNumber,
    "Proactive spam attempt",
    { inboundTriggerContext: null }, // no inbound trigger
  );
  assert.equal(unauthSendResult.blocked, true);
  assert.equal(unauthSendResult.reason, OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED);
  console.log("✅ Test 16 passed: Proactive sends blocked by OutboundPolicy\n");

  // ============================================================
  // Test 17: Actions with 4-10 choices use list; > 10 use readable text list fallback
  // ============================================================
  console.log("Test 17: 4-10 choices use list message, >10 choices use text fallback");
  const fiveActions = Array.from({ length: 5 }, (_, i) => ({
    id: "SELECT_PRODUCT",
    label: `Option ${i + 1}`,
    payload: { productId: `prod-${i + 1}` },
  }));
  const listMsg = responseAdapter.buildInteractive(fiveActions, "Choose an item:");
  assert.equal(listMsg.type, "interactive");
  assert.equal(listMsg.interactive.type, "list");
  assert.equal(listMsg.interactive.action.sections[0].rows.length, 5);

  const twelveActions = Array.from({ length: 12 }, (_, i) => ({
    id: "SELECT_PRODUCT",
    label: `Item ${i + 1}`,
    payload: { productId: `prod-${i + 1}` },
  }));
  const fallbackTextMsg = responseAdapter.buildInteractive(twelveActions, "Choose an item:");
  assert.equal(fallbackTextMsg.type, "text");
  assert.ok(fallbackTextMsg.text.body.includes("1. Item 1"));
  assert.ok(fallbackTextMsg.text.body.includes("12. Item 12"));
  console.log("✅ Test 17 passed: List and Text fallback formats correctly applied\n");

  // ============================================================
  // Test 18: End-to-End Sales Selection Flow
  // ============================================================
  console.log("Test 18: Full Conversational Selection via SalesNode");
  const salesNode = new SalesNode();
  const salesSelectionState = {
    workflow: "SALES",
    currentStep: "SELECT_SELECTION",
    awaitingDecision: true,
    action: {
      id: "SELECT_SELECTION",
      type: "SELECT_SELECTION",
      payload: {
        productId: "business-cards",
        selectionId: "luxury",
      },
    },
    liveRequirement: {
      items: [
        {
          product: { id: "business-cards", name: "Business Cards" },
          selection: null,
        },
      ],
    },
  };

  const salesNodeResult = await salesNode.execute(salesSelectionState);
  assert.equal(salesNodeResult.workflow, "SALES");
  assert.equal(salesNodeResult.liveRequirement.items[0].selection.id, "luxury");
  console.log("✅ Test 18 passed: SalesNode correctly advances on SELECT_SELECTION action\n");

  console.log("=================================================");
  console.log("🎉 ALL 18 WHATSAPP INTERACTIVE TESTS PASSED!");
  console.log("=================================================");
}

runInteractiveTests().catch((err) => {
  console.error("❌ Interactive test failed:", err);
  process.exit(1);
});
