import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import createConversationGraph from "../ai/graph/ConversationGraph.js";
import OrderModel from "../../models/OrderRequest.js";
import LeadBuilder from "../modules/lead/builders/LeadBuilder.js";
import LeadValidator from "../modules/lead/LeadValidator.js";
import LeadConstants from "../modules/lead/helpers/LeadConstants.js";
import WorkflowState from "../modules/workflow/WorkflowState.js";

describe("WhatsApp Lead Cancellation and Routing Suite", () => {
  const leadBuilder = new LeadBuilder();
  const leadValidator = new LeadValidator();
  const workflowState = new WorkflowState();
  let graph;

  let mongoConnected = false;

  before(async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(
          process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/exprintmart_test",
          { serverSelectionTimeoutMS: 2500 },
        );
      }
      mongoConnected = Boolean(
        mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2,
      );
      graph = createConversationGraph();
    } catch {
      mongoConnected = false;
    }
  });

  after(async () => {
    if (mongoConnected) {
      try {
        await mongoose.disconnect();
      } catch {
        // ignore
      }
    }
  });

  async function createConfirmedOrderSession(sessionId, phone) {
    await OrderModel.create({
      sessionId,
      status: "REVIEW",
      channel: "WHATSAPP",
      items: [
        {
          product: { id: 101, name: "Business Cards" },
          selectedProduct: { id: 101, name: "Affordable Business Cards" },
          formData: { quantity: 100 },
        },
      ],
      customer: { phone },
    });

    return await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      action: { id: "CONFIRM_ORDER" },
      whatsapp: { phoneNumber: phone },
    });
  }

  // =========================================================================
  // LEAD BUILDER & SCHEMA VALIDATION TESTS
  // =========================================================================
  it("LeadConstants & LeadBuilder productId and source enum contracts", () => {
    // 1. Source enum must match models/Data.js exact enum 'Exprintmart-(WA)'
    assert.equal(LeadConstants.SOURCES.WHATSAPP, "Exprintmart-(WA)");

    // 2. Slug-based product IDs must map to null, not pass string into numeric field
    const orderWithSlug = {
      items: [
        {
          product: { id: "business-cards", name: "Business Cards" },
        },
      ],
    };
    const extractedSlug = leadBuilder.extractProducts(orderWithSlug, {});
    assert.equal(extractedSlug.length, 1);
    assert.equal(extractedSlug[0].productName, "Business Cards");
    assert.equal(extractedSlug[0].productId, null);

    // 3. Numeric product IDs must be preserved as numbers
    const orderWithNumeric = {
      items: [
        {
          product: { id: 456, name: "Luxury Cards" },
        },
      ],
    };
    const extractedNumeric = leadBuilder.extractProducts(orderWithNumeric, {});
    assert.equal(extractedNumeric[0].productId, 456);

    // 4. Numeric string product IDs should map to Number
    const orderWithNumericString = {
      items: [
        {
          product: { id: "789", name: "Roll Up" },
        },
      ],
    };
    const extractedNumericString = leadBuilder.extractProducts(orderWithNumericString, {});
    assert.equal(extractedNumericString[0].productId, 789);

    // 5. LeadValidator ensures products have numeric or null productId
    const validated = leadValidator.validate({
      name: "Test User",
      phoneNumber: "+971501234567",
      products: [{ productName: "Business Cards", productId: "invalid-slug" }],
    });
    assert.equal(validated.products[0].productId, null);
  });

  // =========================================================================
  // WORKFLOW STATE & ROUTING ENGINE TERMINAL RULES
  // =========================================================================
  it("WorkflowState recognizes LEAD_COMPLETED as completed and inactive", () => {
    const activeLead = { workflow: "LEAD", currentStep: "COLLECT_NAME" };
    assert.equal(workflowState.isCompleted(activeLead), false);
    assert.equal(workflowState.isActive(activeLead), true);

    const completedLead = { workflow: "LEAD", currentStep: "LEAD_COMPLETED" };
    assert.equal(workflowState.isCompleted(completedLead), true);
    assert.equal(workflowState.isActive(completedLead), false);
    assert.equal(workflowState.canInterrupt(completedLead, "sales"), true);
  });

  // =========================================================================
  // TEST 1 — CANCEL DURING NAME
  // =========================================================================
  it("TEST 1: Cancel during COLLECT_NAME resets workflow and allows next sales request", async () => {
    const sessionId = `test_cancel_name_${Date.now()}`;
    const phone = "971509000001";

    const confirmRes = await createConfirmedOrderSession(sessionId, phone);
    assert.ok(
      confirmRes.response?.message?.includes("name"),
      "Should ask for customer full name",
    );
    assert.equal(confirmRes.workflow, "LEAD");
    assert.equal(confirmRes.currentStep, "COLLECT_NAME");

    // Customer sends 'cancel'
    const cancelRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "cancel",
      whatsapp: { phoneNumber: phone },
    });

    assert.ok(
      cancelRes.response?.message?.toLowerCase().includes("cancelled"),
      "Response should confirm order cancellation",
    );
    assert.notEqual(cancelRes.workflow, "LEAD");
    assert.ok(
      !cancelRes.response?.message?.includes("May I know your full name"),
      "Must not repeat 'May I know your full name?' on cancel",
    );

    // Customer sends new request: 'i want business cards'
    const nextRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "i want business cards",
      whatsapp: { phoneNumber: phone },
    });

    assert.ok(
      !nextRes.response?.message?.includes("May I know your full name"),
      "Must not be stuck asking for name from cancelled lead",
    );
    assert.ok(
      nextRes.workflow === "SALES" || nextRes.response?.workflow === "SALES" || nextRes.response?.type === "sales",
      "Should route to normal SALES workflow",
    );
  });

  // =========================================================================
  // TEST 2 — CANCEL DURING EMAIL
  // =========================================================================
  it("TEST 2: Cancel during COLLECT_EMAIL cancels lead collection immediately", async () => {
    const sessionId = `test_cancel_email_${Date.now()}`;
    const phone = "971509000002";

    await createConfirmedOrderSession(sessionId, phone);

    // Provide name
    const nameRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "John Doe",
      whatsapp: { phoneNumber: phone },
    });
    assert.ok(
      nameRes.response?.message?.toLowerCase().includes("email"),
      "Should ask for email",
    );
    assert.equal(nameRes.workflow, "LEAD");
    assert.equal(nameRes.currentStep, "COLLECT_EMAIL");

    // Cancel during email
    const cancelRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "cancel",
      whatsapp: { phoneNumber: phone },
    });
    assert.ok(
      cancelRes.response?.message?.toLowerCase().includes("cancelled"),
      "Should confirm cancellation",
    );
    assert.notEqual(cancelRes.workflow, "LEAD");
    assert.ok(
      !cancelRes.response?.message?.toLowerCase().includes("company"),
      "Must not ask for company",
    );

    // New request starts normally
    const nextRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "i want business cards",
      whatsapp: { phoneNumber: phone },
    });
    assert.ok(!nextRes.response?.message?.toLowerCase().includes("company"));
    assert.notEqual(nextRes.workflow, "LEAD");
  });

  // =========================================================================
  // TEST 3 — CANCEL DURING COMPANY
  // =========================================================================
  it("TEST 3: Cancel during COLLECT_COMPANY cancels lead and prevents CREATE_LEAD", async () => {
    const sessionId = `test_cancel_company_${Date.now()}`;
    const phone = "971509000003";

    await createConfirmedOrderSession(sessionId, phone);

    // Provide name
    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "John Doe",
      whatsapp: { phoneNumber: phone },
    });

    // Provide email
    const emailRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "john.doe@example.com",
      whatsapp: { phoneNumber: phone },
    });
    assert.ok(
      emailRes.response?.message?.toLowerCase().includes("company"),
      "Should ask for company",
    );
    assert.equal(emailRes.workflow, "LEAD");
    assert.equal(emailRes.currentStep, "COLLECT_COMPANY");

    // Cancel during company
    const cancelRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "cancel",
      whatsapp: { phoneNumber: phone },
    });
    assert.ok(
      cancelRes.response?.message?.toLowerCase().includes("cancelled"),
      "Should confirm cancellation",
    );
    assert.notEqual(cancelRes.workflow, "LEAD");
    assert.ok(
      !cancelRes.response?.message?.includes("received successfully"),
      "Must not create lead or send completion message",
    );

    // Next new request starts normally
    const nextRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "i want business cards",
      whatsapp: { phoneNumber: phone },
    });
    assert.ok(!nextRes.response?.message?.includes("received successfully"));
    assert.notEqual(nextRes.workflow, "LEAD");
  });

  // =========================================================================
  // TEST 4 — COMPLETED LEAD + NEW SALES REQUEST
  // =========================================================================
  it("TEST 4: Completed lead followed by 'i want business cards' leaves LEAD and enters SALES", async () => {
    const sessionId = `test_completed_sales_${Date.now()}`;
    const phone = "971509000004";

    await createConfirmedOrderSession(sessionId, phone);

    // 1. Name
    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "Nawaz Gadiwale",
      whatsapp: { phoneNumber: phone },
    });

    // 2. Email
    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "nawaz.gadiwale@gmail.com",
      whatsapp: { phoneNumber: phone },
    });

    // 3. Skip company -> completes lead
    const completedRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "skip",
      whatsapp: { phoneNumber: phone },
    });

    assert.ok(
      completedRes.response?.message?.includes("received successfully"),
      "Should send lead completion message",
    );
    assert.equal(completedRes.currentStep, "LEAD_COMPLETED");

    // 4. Now send completely new sales request
    const newReqRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "i want business cards",
      whatsapp: { phoneNumber: phone },
    });

    assert.ok(
      !newReqRes.response?.message?.includes("received successfully"),
      "Must NOT repeat 'Thank you. Your details have been received successfully.'",
    );
    assert.ok(
      !newReqRes.response?.message?.includes("May I know your full name"),
      "Must NOT execute LeadAgent asking for name",
    );
    assert.ok(
      newReqRes.workflow === "SALES" || newReqRes.response?.workflow === "SALES" || newReqRes.response?.type === "sales",
      "Should route to SALES workflow",
    );
  });

  // =========================================================================
  // TEST 5 — COMPLETED LEAD + FAQ
  // =========================================================================
  it("TEST 5: Completed lead followed by FAQ routes to FAQ without forcing SALES or repeating LEAD", async () => {
    const sessionId = `test_completed_faq_${Date.now()}`;
    const phone = "971509000005";

    await createConfirmedOrderSession(sessionId, phone);

    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "Nawaz Gadiwale",
      whatsapp: { phoneNumber: phone },
    });

    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "nawaz.gadiwale@gmail.com",
      whatsapp: { phoneNumber: phone },
    });

    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "skip",
      whatsapp: { phoneNumber: phone },
    });

    // Now ask FAQ
    const faqRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "What are your delivery timings?",
      whatsapp: { phoneNumber: phone },
    });

    assert.ok(
      !faqRes.response?.message?.includes("received successfully"),
      "Must not repeat lead completion response",
    );
    assert.ok(
      !faqRes.response?.message?.includes("May I know your full name"),
      "Must not ask for name",
    );
    assert.ok(
      faqRes.response?.type === "faq" ||
        faqRes.response?.metadata?.capability === "faq" ||
        faqRes.workflow === "FAQ" ||
        faqRes.capability === "faq" ||
        faqRes.response?.message?.toLowerCase().includes("delivery"),
      "Should handle FAQ query properly",
    );
  });

  // =========================================================================
  // TEST 6 — COMPLETED LEAD + NEW PRODUCT
  // =========================================================================
  it("TEST 6: Completed lead followed by another product starts a fresh product discovery", async () => {
    const sessionId = `test_completed_banner_${Date.now()}`;
    const phone = "971509000006";

    await createConfirmedOrderSession(sessionId, phone);

    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "Nawaz Gadiwale",
      whatsapp: { phoneNumber: phone },
    });

    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "nawaz.gadiwale@gmail.com",
      whatsapp: { phoneNumber: phone },
    });

    await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "skip",
      whatsapp: { phoneNumber: phone },
    });

    // Customer requests another product
    const bannerRes = await graph.invoke({
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      channel: "WHATSAPP",
      userMessage: "I need roll-up banners",
      whatsapp: { phoneNumber: phone },
    });

    assert.ok(
      !bannerRes.response?.message?.includes("received successfully"),
      "Must not repeat lead completion response",
    );
    assert.ok(
      bannerRes.response?.message?.toLowerCase().includes("roll-up") ||
        bannerRes.response?.message?.toLowerCase().includes("banner") ||
        bannerRes.selectedProduct?.slug === "roll-up-banner" ||
        bannerRes.workflow === "SALES",
      "Must discover roll-up banner",
    );
  });
});
