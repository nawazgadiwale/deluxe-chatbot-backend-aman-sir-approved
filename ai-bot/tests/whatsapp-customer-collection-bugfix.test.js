import test from "node:test";
import assert from "node:assert/strict";

import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesNode from "../ai/graph/nodes/SalesNode.js";
import LoadSessionNode from "../ai/graph/nodes/LoadSessionNode.js";
import SaveSessionNode from "../ai/graph/nodes/SaveSessionNode.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";

const salesBrain = new SalesBrain();
const salesNode = new SalesNode();
const orderManager = new OrderManager();
const responseAdapter = new WhatsAppResponseAdapter();
const loadSessionNode = new LoadSessionNode();
const saveSessionNode = new SaveSessionNode();

test("WhatsApp Customer Collection Bugfix Exact Scenario", async (t) => {
  await t.test(
    "Configures Affordable Business Cards, confirms order, and completes collection with raw text messages",
    async () => {
      // 1. Configure product: Affordable Business Cards (Quantity 200, Names 2, 350gsm Art Matt, none, Store Pickup)
      const initialRequirement = {
        items: [
          {
            product: {
              id: "affordable",
              name: "Affordable Business Cards",
              slug: "affordable-business-cards",
            },
            orderStarted: true,
            formData: {
              quantity: 200,
              numberOfNames: 2,
              material: "350gsm Art Matt",
              lamination: "none",
              deliveryMethod: "pickup",
            },
            workflow: {
              quantity: 200,
            },
            delivery: {
              method: "pickup",
            },
          },
        ],
        delivery: {
          method: "pickup",
        },
      };

      // 2. Bot displays review summary
      let state = {
        sessionId: "session-customer-test-1",
        channel: "WHATSAPP",
        whatsapp: { phoneNumber: "971501234567" },
        workflow: "SALES",
        currentStep: "REVIEW_ORDER",
        liveRequirement: initialRequirement,
        metadata: {
          routing: {
            capability: "sales",
            workflow: "SALES",
            step: "REVIEW_ORDER",
          },
        },
      };

      // 3. User clicks: Confirm Order
      state = {
        ...state,
        action: { id: "CONFIRM_ORDER" },
        userMessage: "",
      };

      let salesResult = await salesBrain.execute(state);

      // Verify CONFIRM_ORDER transitions to COLLECT_CUSTOMER deterministically
      assert.equal(salesResult.currentStep, "COLLECT_CUSTOMER");
      assert.equal(salesResult.metadata?.routing?.step, "COLLECT_CUSTOMER");
      assert.equal(salesResult.liveRequirement.items[0].confirmClicked, true);
      assert.equal(salesResult.liveRequirement.items[0].reviewCompleted, true);

      // Bot asks for full name
      assert.ok(
        salesResult.response.message.includes(
          "Great! To complete your order, please enter your full name.",
        ),
      );
      assert.ok(
        !salesResult.response.message.includes("Order Summary"),
        "No duplicate summary on confirm",
      );

      // 4. Simulate turn state passing through SalesNode
      state = await salesNode.execute({
        ...state,
        action: { id: "CONFIRM_ORDER" },
      });
      assert.equal(state.currentStep, "COLLECT_CUSTOMER");
      assert.equal(state.metadata?.routing?.step, "COLLECT_CUSTOMER");

      // 5. User sends plain text: "nawaz"
      // Raw action = null, user message = "nawaz"
      state = {
        ...state,
        action: null,
        message: "nawaz",
        userMessage: "nawaz",
      };

      state = await salesNode.execute(state);

      // Bot MUST NOT ask for name again!
      assert.equal(state.currentStep, "COLLECT_CUSTOMER");
      assert.equal(state.metadata?.routing?.step, "COLLECT_CUSTOMER");
      assert.ok(
        !state.assistantMessage.includes("enter your full name"),
        "MUST NOT ask for name again",
      );
      assert.ok(
        state.assistantMessage.includes("enter your email address"),
        `Expected email prompt, got: ${state.assistantMessage}`,
      );
      assert.equal(state.customer.name, "nawaz");
      assert.equal(state.customer.awaitingCustomerField, "email");
      assert.equal(state.liveRequirement.customer.name, "nawaz");

      // 6. User sends plain text: "nawaz@example.com"
      state = {
        ...state,
        action: null,
        message: "nawaz@example.com",
        userMessage: "nawaz@example.com",
      };

      state = await salesNode.execute(state);

      // Bot MUST NOT ask for name or email again!
      assert.equal(state.currentStep, "COLLECT_CUSTOMER");
      assert.equal(state.metadata?.routing?.step, "COLLECT_CUSTOMER");
      assert.ok(
        !state.assistantMessage.includes("enter your full name"),
        "MUST NOT ask for name again",
      );
      assert.ok(
        !state.assistantMessage.includes("enter your email address"),
        "MUST NOT ask for email again",
      );
      assert.ok(
        state.assistantMessage.includes("Company name is optional"),
        `Expected company prompt, got: ${state.assistantMessage}`,
      );
      assert.equal(state.customer.name, "nawaz");
      assert.equal(state.customer.email, "nawaz@example.com");
      assert.equal(state.customer.awaitingCustomerField, "company");

      // 7. User sends plain text: "Skip"
      state = {
        ...state,
        action: null,
        message: "Skip",
        userMessage: "Skip",
      };

      state = await salesNode.execute(state);

      // Lead created once, order confirmed and completed
      assert.equal(state.currentStep, "ORDER_COMPLETED");
      assert.equal(state.completed, true);
      assert.equal(state.confirmed, true);
      assert.ok(
        state.assistantMessage.includes("submitted successfully"),
      );
      assert.ok(
        !state.assistantMessage.includes("enter your full name"),
      );
      assert.ok(
        !state.assistantMessage.includes("Order Summary"),
      );

      // Verify customer details
      assert.equal(state.customer.name, "nawaz");
      assert.equal(state.customer.email, "nawaz@example.com");
      assert.equal(state.customer.company, null);
      assert.equal(state.customer.phone, "971501234567");

      // Verify lead details
      assert.ok(state.lead, "Lead must be created");
      assert.equal(state.lead.name, "nawaz");
      assert.equal(state.lead.emailId, "nawaz@example.com");
      assert.equal(state.lead.phoneNumber, "971501234567");
      assert.equal(
        state.lead.products?.[0]?.productName,
        "Affordable Business Cards",
      );

      // Verify order has leadId attached
      assert.ok(state.order.leadId, "Order must have leadId attached");

      // Verify no phone number was ever requested in response messages
      const finalMessages = responseAdapter.toWhatsAppMessages(state);
      for (const m of finalMessages) {
        const text = JSON.stringify(m);
        assert.ok(!text.includes("phone number"), "Phone must never be asked");
        assert.ok(!text.includes("mobile number"), "Mobile must never be asked");
      }
    },
  );

  await t.test(
    "Invalid email format shows validation error and re-prompts for email without resetting name",
    async () => {
      let state = {
        sessionId: "session-invalid-email-test",
        channel: "WHATSAPP",
        whatsapp: { phoneNumber: "971501234567" },
        workflow: "SALES",
        currentStep: "COLLECT_CUSTOMER",
        customer: { name: "nawaz" },
        liveRequirement: {
          items: [
            {
              product: { id: "affordable" },
              orderStarted: true,
              customer: { name: "nawaz" },
            },
          ],
          customer: { name: "nawaz" },
        },
        action: null,
        message: "invalid-email-string",
        userMessage: "invalid-email-string",
      };

      const res = await salesBrain.execute(state);
      assert.equal(res.currentStep, "COLLECT_CUSTOMER");
      assert.ok(
        res.response.message.includes("valid email"),
        "Must show invalid email message",
      );
      assert.ok(
        !res.response.message.includes("enter your full name"),
        "Must NOT ask for name again",
      );
      assert.equal(res.customer.name, "nawaz");
    },
  );

  await t.test(
    "Entering actual company name persists company to customer and lead",
    async () => {
      let state = {
        sessionId: "session-company-test",
        channel: "WHATSAPP",
        whatsapp: { phoneNumber: "971501234567" },
        workflow: "SALES",
        currentStep: "COLLECT_CUSTOMER",
        customer: { name: "nawaz", email: "nawaz@example.com" },
        liveRequirement: {
          items: [
            {
              product: { id: "affordable" },
              orderStarted: true,
              customer: { name: "nawaz", email: "nawaz@example.com" },
            },
          ],
          customer: { name: "nawaz", email: "nawaz@example.com" },
        },
        action: null,
        message: "Acme Corp",
        userMessage: "Acme Corp",
      };

      const res = await salesBrain.execute(state);
      assert.equal(res.currentStep, "ORDER_COMPLETED");
      assert.equal(res.customer.company, "Acme Corp");
      assert.equal(res.lead.companyName, "Acme Corp");
    },
  );
});
