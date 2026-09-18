import assert from "node:assert/strict";
import LoadSessionNode from "../ai/graph/nodes/LoadSessionNode.js";
import GreetingNode from "../ai/graph/nodes/GreetingNode.js";
import SaveSessionNode from "../ai/graph/nodes/SaveSessionNode.js";
import SalesBrain from "../modules/sales/SalesBrain.js";
import ConversationRepository from "../repositories/ConversationRepository.js";
import OrderRepository from "../repositories/OrderRequestRepository.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING STRICT TESTS: RETURNING CUSTOMER & ORDER IMMUTABILITY");
  console.log("=================================================\n");

  const loadSessionNode = new LoadSessionNode();
  const greetingNode = new GreetingNode();
  const saveSessionNode = new SaveSessionNode();
  const salesBrain = new SalesBrain();

  const convRepo = new ConversationRepository();
  const orderRepo = new OrderRepository();

  // Test setup: mock store when DB is disconnected
  const mockDb = {
    conversations: new Map(),
    orders: new Map(),
  };

  // Mock repository prototypes to test cleanly
  ConversationRepository.prototype.isConnected = () => true;
  OrderRepository.prototype.isConnected = () => true;

  ConversationRepository.prototype.findBySessionId = async function (sessionId, site = "exprintmart") {
    return mockDb.conversations.get(sessionId) || null;
  };

  ConversationRepository.prototype.getVisitorSummary = async function (visitorId, site = "exprintmart") {
    const list = Array.from(mockDb.conversations.values()).filter(
      (c) => c.visitorId === visitorId,
    );
    const totalSessions = list.length || 1;
    const hasOrdered = list.some(
      (c) =>
        c.engagement?.hasOrdered ||
        c.visitorContext?.hasOrdered ||
        c.hasOrdered ||
        c.visitorType === "CUSTOMER",
    );
    const hasQuotation = list.some(
      (c) =>
        c.engagement?.hasRequestedQuote ||
        c.visitorContext?.hasRequestedQuote ||
        c.requestType === "QUOTATION" ||
        c.visitorType === "QUOTATION" ||
        c.visitorType === "QOUTATION",
    );
    const hasLead = list.some(
      (c) =>
        c.engagement?.hasSubmittedLead ||
        c.visitorContext?.hasSubmittedLead ||
        c.visitorType === "LEAD" ||
        c.isLead,
    );
    const hasCustomerInfo = list.some(
      (c) => Boolean(c.customer?.name || c.customer?.phone || c.customer?.email),
    );
    const hasMessages = list.some(
      (c) => (Array.isArray(c.messages) && c.messages.length > 0) || c.lastUserMessageAt,
    );
    const hasPreviousSession = list.some(
      (c) => Boolean(c.previousSessionId || (c.totalSessions && c.totalSessions > 1)),
    );

    const isReturningVisitor =
      totalSessions > 1 ||
      Boolean(
        hasMessages ||
        hasPreviousSession ||
        hasOrdered ||
        hasCustomerInfo ||
        hasLead ||
        hasQuotation,
      );

    const isKnownCustomer = Boolean(hasOrdered || hasCustomerInfo);

    return {
      totalSessions: Math.max(totalSessions, list[0]?.totalSessions || 1),
      isReturningVisitor,
      isKnownCustomer,
      isQuotationCustomer: Boolean(hasQuotation),
      isLead: Boolean(hasLead),
      hasOrdered: Boolean(hasOrdered),
      hasSubmittedLead: Boolean(hasLead),
      hasRequestedQuote: Boolean(hasQuotation),
      isPureVisitor: !isReturningVisitor && !isKnownCustomer && !hasOrdered && !hasQuotation && !hasLead,
      customer: list[0]?.customer ?? {},
    };
  };

  ConversationRepository.prototype.findLatestPreviousSession = async function (visitorId, currentSessionId) {
    for (const c of mockDb.conversations.values()) {
      if (c.visitorId === visitorId && c.sessionId !== currentSessionId) {
        return c;
      }
    }
    return null;
  };

  ConversationRepository.prototype.createConversation = async function (data) {
    const doc = {
      _id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...data,
      messages: data.messages || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.conversations.set(data.sessionId, doc);
    return doc;
  };

  ConversationRepository.prototype.update = async function (filter, update) {
    const sessionId = filter.sessionId;
    const existing = mockDb.conversations.get(sessionId) || { sessionId };
    const $set = update.$set || {};
    const updated = {
      ...existing,
      ...$set,
      customer: {
        ...(existing.customer || {}),
        ...($set.customer || {}),
      },
      engagement: {
        ...(existing.engagement || {}),
        ...($set.engagement || {}),
      },
      visitorContext: {
        ...(existing.visitorContext || {}),
        ...($set.visitorContext || {}),
      },
      metadata: {
        ...(existing.metadata || {}),
        ...($set.metadata || {}),
      },
      updatedAt: new Date(),
    };
    mockDb.conversations.set(sessionId, updated);
    return updated;
  };

  OrderRepository.prototype.findActiveBySession = async function (sessionId) {
    for (const order of mockDb.orders.values()) {
      if (
        order.sessionId === sessionId &&
        !["CONFIRMED", "SUBMITTED", "CANCELLED", "DELETED"].includes(order.status) &&
        !order.confirmed
      ) {
        return order;
      }
    }
    return null;
  };

  OrderRepository.prototype.findHistoryBySessionOrPhone = async function (sessionId, phone = null) {
    const results = [];
    const cleanDigits = phone ? String(phone).replace(/\D/g, "") : null;
    for (const order of mockDb.orders.values()) {
      const orderPhone = order.customer?.phone
        ? String(order.customer.phone).replace(/\D/g, "")
        : null;
      if (
        order.sessionId === sessionId ||
        (cleanDigits && orderPhone === cleanDigits)
      ) {
        results.push(order);
      }
    }
    return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  OrderRepository.prototype.findByConversationId = async function (conversationId) {
    for (const order of mockDb.orders.values()) {
      if (String(order.conversationId) === String(conversationId)) {
        return order;
      }
    }
    return null;
  };

  OrderRepository.prototype.saveDraft = async function (sessionId, conversationId, orderData) {
    const existingId = orderData._id;
    if (existingId && mockDb.orders.has(existingId)) {
      const existing = mockDb.orders.get(existingId);
      if (
        (existing.status === "CONFIRMED" || existing.confirmed) &&
        orderData.status !== "CONFIRMED"
      ) {
        // Never overwrite confirmed order! Create new one instead
        const newId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const fresh = {
          ...orderData,
          _id: newId,
          sessionId,
          conversationId,
          createdAt: new Date(),
        };
        mockDb.orders.set(newId, fresh);
        return fresh;
      }
      const updated = { ...existing, ...orderData, updatedAt: new Date() };
      mockDb.orders.set(existingId, updated);
      return updated;
    }
    const orderId = existingId || `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved = {
      ...orderData,
      _id: orderId,
      sessionId,
      conversationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.orders.set(orderId, saved);
    return saved;
  };

  // -------------------------------------------------------------
  // TEST 1 — NEW VISITOR
  // No history.
  // Expected:
  // visitorType = VISITOR
  // isPureVisitor = true
  // isReturningVisitor = false
  // hasOrdered = false
  // Greeting = visitor message.
  // -------------------------------------------------------------
  console.log("👉 TEST 1 — NEW VISITOR");
  {
    const state = {
      sessionId: "whatsapp:test_phone_id:919999900001",
      visitorId: "whatsapp:test_phone_id:919999900001",
      site: "exprintmart",
      userMessage: "Hello",
      persistence: { conversation: {}, order: {} },
    };

    const loadedState = await loadSessionNode.execute(state);

    assert.equal(loadedState.visitorType, "VISITOR", "TEST 1: visitorType must be VISITOR");
    assert.equal(loadedState.isPureVisitor, true, "TEST 1: isPureVisitor must be true");
    assert.equal(loadedState.isReturningVisitor, false, "TEST 1: isReturningVisitor must be false");
    assert.equal(loadedState.hasOrdered, false, "TEST 1: hasOrdered must be false");

    const greetedState = await greetingNode.execute(loadedState);
    assert.ok(
      greetedState.response?.message?.includes("Welcome to Deluxe Printing"),
      "TEST 1: Greeting must be new visitor message",
    );
    assert.ok(
      !greetedState.response?.message?.includes("Welcome back"),
      "TEST 1: Greeting must NOT include Welcome back",
    );
    console.log("✅ TEST 1 PASSED\n");
  }

  // -------------------------------------------------------------
  // TEST 2 — RETURNING CUSTOMER
  // Existing customer/conversation history.
  // Expected:
  // visitorType != VISITOR
  // isReturningVisitor = true
  // isPureVisitor = false
  // Greeting = returning customer message.
  // -------------------------------------------------------------
  console.log("👉 TEST 2 — RETURNING CUSTOMER");
  {
    const sessionId = "whatsapp:test_phone_id:919999900002";
    // Seed existing conversation with customer info & previous messages
    mockDb.conversations.set(sessionId, {
      _id: "conv_test_2",
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      customer: { name: "Ahmed", phone: "+971500000002" },
      visitorType: "CUSTOMER",
      isReturningVisitor: true,
      isPureVisitor: false,
      isKnownCustomer: true,
      totalSessions: 2,
      messages: [
        { role: "user", content: "Hi there" },
        { role: "assistant", content: "Hello Ahmed" },
      ],
      lastUserMessageAt: new Date(Date.now() - 3600000),
      createdAt: new Date(Date.now() - 7200000),
    });

    const state = {
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      userMessage: "Hello again",
      persistence: { conversation: {}, order: {} },
    };

    const loadedState = await loadSessionNode.execute(state);

    assert.notEqual(loadedState.visitorType, "VISITOR", "TEST 2: visitorType must != VISITOR");
    assert.equal(loadedState.isReturningVisitor, true, "TEST 2: isReturningVisitor must be true");
    assert.equal(loadedState.isPureVisitor, false, "TEST 2: isPureVisitor must be false");

    const greetedState = await greetingNode.execute(loadedState);
    assert.ok(
      (greetedState.response?.message || greetedState.response?.data?.message)?.includes("Welcome back, Ahmed!"),
      "TEST 2: Greeting must be returning customer message with name",
    );
    console.log("✅ TEST 2 PASSED\n");
  }

  // -------------------------------------------------------------
  // TEST 3 — CUSTOMER WITH PREVIOUS SUBMITTED ORDER
  // Existing submitted order.
  // Expected:
  // hasOrdered = true
  // isReturningVisitor = true
  // isPureVisitor = false
  // Greeting = returning customer message.
  // The previous order remains unchanged.
  // -------------------------------------------------------------
  console.log("👉 TEST 3 — CUSTOMER WITH PREVIOUS SUBMITTED ORDER");
  {
    const sessionId = "whatsapp:test_phone_id:919999900003";
    const orderId = "order_submitted_test_3";

    mockDb.orders.set(orderId, {
      _id: orderId,
      orderNumber: "ORD-1001",
      sessionId,
      status: "CONFIRMED",
      confirmed: true,
      customer: { name: "Fatima", phone: "+971500000003" },
      items: [{ product: { name: "Business Cards" }, quantity: 500 }],
      createdAt: new Date(Date.now() - 86400000),
    });

    mockDb.conversations.set(sessionId, {
      _id: "conv_test_3",
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      customer: { name: "Fatima", phone: "+971500000003" },
      engagement: { hasOrdered: true },
      visitorType: "CUSTOMER",
      messages: [{ role: "user", content: "order completed" }],
      createdAt: new Date(Date.now() - 86400000),
    });

    const state = {
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      userMessage: "Hi",
      persistence: { conversation: {}, order: {} },
    };

    const loadedState = await loadSessionNode.execute(state);

    assert.equal(loadedState.hasOrdered, true, "TEST 3: hasOrdered must be true");
    assert.equal(loadedState.isReturningVisitor, true, "TEST 3: isReturningVisitor must be true");
    assert.equal(loadedState.isPureVisitor, false, "TEST 3: isPureVisitor must be false");

    const greetedState = await greetingNode.execute(loadedState);
    assert.ok(
      (greetedState.response?.message || greetedState.response?.data?.message)?.includes("Welcome back, Fatima!"),
      "TEST 3: Greeting must be returning customer message",
    );

    // Verify historical order remains untouched in DB
    const persistedOrder = mockDb.orders.get(orderId);
    assert.equal(persistedOrder.status, "CONFIRMED", "TEST 3: Historical order status must stay CONFIRMED");
    assert.equal(persistedOrder.items[0].product.name, "Business Cards", "TEST 3: Items unchanged");
    assert.equal(persistedOrder.items[0].quantity, 500, "TEST 3: Quantity unchanged");
    console.log("✅ TEST 3 PASSED\n");
  }

  // -------------------------------------------------------------
  // TEST 4 — RETURNING CUSTOMER STARTS NEW ORDER
  // Previous: ORDER #1 = submitted.
  // Customer sends: "I need business cards"
  // Expected:
  // ORDER #1 remains unchanged.
  // A new active requirement/order context is created for ORDER #2.
  // -------------------------------------------------------------
  console.log("👉 TEST 4 — RETURNING CUSTOMER STARTS NEW ORDER");
  {
    const sessionId = "whatsapp:test_phone_id:919999900004";
    const order1Id = "order_1_immutable";

    mockDb.orders.set(order1Id, {
      _id: order1Id,
      orderNumber: "ORD-9999",
      sessionId,
      status: "CONFIRMED",
      confirmed: true,
      customer: { name: "Zaid", phone: "+971500000004" },
      items: [{ product: { name: "Flyers" }, quantity: 1000 }],
      createdAt: new Date(Date.now() - 1000000),
    });

    mockDb.conversations.set(sessionId, {
      _id: "conv_test_4",
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      customer: { name: "Zaid", phone: "+971500000004" },
      engagement: { hasOrdered: true },
      visitorType: "CUSTOMER",
      messages: [{ role: "user", content: "confirmed order 1" }],
    });

    const state = {
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      userMessage: "I need business cards",
      persistence: { conversation: {}, order: {} },
    };

    const loadedState = await loadSessionNode.execute(state);
    // loadedState.order should be null because order #1 is confirmed history
    assert.equal(loadedState.order, null, "TEST 4: loadedState.order must be null (no active order)");
    assert.ok(loadedState.historicalOrder, "TEST 4: loadedState.historicalOrder must hold order #1");

    const salesState = await salesBrain.execute(loadedState);

    // Verify order #1 in database remains completely untouched
    const order1 = mockDb.orders.get(order1Id);
    assert.equal(order1.status, "CONFIRMED", "TEST 4: Order #1 status must still be CONFIRMED");
    assert.equal(order1.orderNumber, "ORD-9999", "TEST 4: Order #1 number must still be ORD-9999");
    assert.equal(order1.items[0].product.name, "Flyers", "TEST 4: Order #1 product must still be Flyers");
    assert.equal(order1.items[0].quantity, 1000, "TEST 4: Order #1 quantity must still be 1000");

    // Verify a new active requirement was created for business cards
    assert.ok(salesState.liveRequirement, "TEST 4: New liveRequirement must exist");
    assert.notEqual(salesState.liveRequirement._id, order1Id, "TEST 4: New requirement must not have Order #1 ID");
    assert.notEqual(salesState.liveRequirement.orderNumber, "ORD-9999", "TEST 4: New requirement must not have Order #1 number");
    console.log("✅ TEST 4 PASSED\n");
  }

  // -------------------------------------------------------------
  // TEST 5 — GREETING MUST NOT CREATE ORDER
  // Customer sends: "Hi"
  // Expected:
  // Greeting only.
  // No new order is created.
  // No existing order is modified.
  // -------------------------------------------------------------
  console.log("👉 TEST 5 — GREETING MUST NOT CREATE ORDER");
  {
    const initialOrderCount = mockDb.orders.size;
    const sessionId = "whatsapp:test_phone_id:919999900005";

    const state = {
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      userMessage: "Hi",
      persistence: { conversation: {}, order: { dirty: false } },
    };

    const loadedState = await loadSessionNode.execute(state);
    const greetedState = await greetingNode.execute(loadedState);

    assert.equal(greetedState.persistence.order.dirty, false, "TEST 5: order persistence must NOT be dirty");
    assert.equal(greetedState.order, null, "TEST 5: state.order must be null");

    // Save session
    await saveSessionNode.execute(greetedState);

    assert.equal(
      mockDb.orders.size,
      initialOrderCount,
      "TEST 5: Order count in database must not increase after greeting",
    );
    console.log("✅ TEST 5 PASSED\n");
  }

  // -------------------------------------------------------------
  // TEST 6 — UNDEFINED STATE MUST NOT OVERWRITE DATABASE
  // Existing:
  // visitorType = CUSTOMER
  // isReturningVisitor = true
  // hasOrdered = true
  // Current state contains:
  // visitorType = undefined
  // isReturningVisitor = undefined
  // hasOrdered = undefined
  // After save:
  // visitorType = CUSTOMER
  // isReturningVisitor = true
  // hasOrdered = true
  // Nothing is overwritten by undefined.
  // -------------------------------------------------------------
  console.log("👉 TEST 6 — UNDEFINED STATE MUST NOT OVERWRITE DATABASE");
  {
    const sessionId = "whatsapp:test_phone_id:919999900006";

    mockDb.conversations.set(sessionId, {
      _id: "conv_test_6",
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      visitorType: "CUSTOMER",
      isReturningVisitor: true,
      hasOrdered: true,
      isKnownCustomer: true,
      engagement: { hasOrdered: true },
      visitorContext: {
        hasOrdered: true,
        isReturningVisitor: true,
      },
      customer: { name: "Khalid", phone: "+971500000006" },
      messages: [{ role: "user", content: "order" }],
    });

    // Pass state containing undefined for these fields
    const state = {
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      visitorType: undefined,
      isReturningVisitor: undefined,
      hasOrdered: undefined,
      isKnownCustomer: undefined,
      customer: undefined,
      persistence: { conversation: { dirty: true } },
    };

    await saveSessionNode.execute(state);

    const savedConv = mockDb.conversations.get(sessionId);
    assert.equal(savedConv.visitorType, "CUSTOMER", "TEST 6: visitorType must remain CUSTOMER");
    assert.equal(savedConv.isReturningVisitor, true, "TEST 6: isReturningVisitor must remain true");
    assert.equal(savedConv.hasOrdered, true, "TEST 6: hasOrdered must remain true");
    assert.equal(savedConv.isKnownCustomer, true, "TEST 6: isKnownCustomer must remain true");
    assert.equal(savedConv.customer?.name, "Khalid", "TEST 6: customer.name must remain Khalid");
    console.log("✅ TEST 6 PASSED\n");
  }

  // -------------------------------------------------------------
  // TEST 7 — SAME WHATSAPP NUMBER
  // Send multiple messages using the same normalized WhatsApp number.
  // Expected:
  // same customer identity
  // same historical records
  // no duplicate customer classification
  // no historical order mutation
  // new active order only when explicitly started
  // -------------------------------------------------------------
  console.log("👉 TEST 7 — SAME WHATSAPP NUMBER MULTI-MESSAGE CONSISTENCY");
  {
    const sessionId = "whatsapp:test_phone_id:918310412768";
    const phone = "+918310412768";

    // Message 1: Customer submits an order
    const state1 = {
      sessionId,
      visitorId: sessionId,
      customerWaId: phone,
      site: "exprintmart",
      userMessage: "Hello",
      customer: { name: "Nawaz", phone },
      persistence: { conversation: {}, order: {} },
    };
    const loaded1 = await loadSessionNode.execute(state1);
    await greetingNode.execute(loaded1);
    await saveSessionNode.execute(loaded1);

    // Complete order 1
    const order1Id = "order_nawaz_1";
    mockDb.orders.set(order1Id, {
      _id: order1Id,
      orderNumber: "ORD-NAWAZ-1",
      sessionId,
      status: "CONFIRMED",
      confirmed: true,
      customer: { name: "Nawaz", phone },
      items: [{ product: { name: "Business Cards" }, quantity: 500 }],
      createdAt: new Date(),
    });
    const convAfterOrder1 = mockDb.conversations.get(sessionId);
    convAfterOrder1.engagement = { hasOrdered: true };
    convAfterOrder1.hasOrdered = true;
    convAfterOrder1.visitorType = "CUSTOMER";
    convAfterOrder1.isReturningVisitor = true;
    mockDb.conversations.set(sessionId, convAfterOrder1);

    // Message 2: Customer sends "Hi" after order is submitted
    const state2 = {
      sessionId,
      visitorId: sessionId,
      customerWaId: phone,
      site: "exprintmart",
      userMessage: "Hi",
      persistence: { conversation: {}, order: {} },
    };
    const loaded2 = await loadSessionNode.execute(state2);

    assert.equal(loaded2.visitorType, "CUSTOMER", "TEST 7 (Msg 2): visitorType must be CUSTOMER");
    assert.equal(loaded2.isReturningVisitor, true, "TEST 7 (Msg 2): isReturningVisitor must be true");
    assert.equal(loaded2.hasOrdered, true, "TEST 7 (Msg 2): hasOrdered must be true");
    assert.equal(loaded2.order, null, "TEST 7 (Msg 2): state.order must be null (no active order)");
    assert.ok(loaded2.historicalOrder, "TEST 7 (Msg 2): historicalOrder must be set");

    const greeted2 = await greetingNode.execute(loaded2);
    assert.ok(
      (greeted2.response?.message || greeted2.response?.data?.message)?.includes("Welcome back, Nawaz!"),
      "TEST 7 (Msg 2): Greeting must recognize Nawaz",
    );
    await saveSessionNode.execute(greeted2);

    // Verify order 1 is still intact
    const orderCheckAfterMsg2 = mockDb.orders.get(order1Id);
    assert.equal(orderCheckAfterMsg2.status, "CONFIRMED", "TEST 7: Order 1 status intact");
    assert.equal(orderCheckAfterMsg2.items[0].product.name, "Business Cards", "TEST 7: Order 1 items intact");

    // Message 3: Customer explicitly starts a new order "I need flyers"
    const state3 = {
      sessionId,
      visitorId: sessionId,
      customerWaId: phone,
      site: "exprintmart",
      userMessage: "I need flyers",
      persistence: { conversation: {}, order: {} },
    };
    const loaded3 = await loadSessionNode.execute(state3);
    const sales3 = await salesBrain.execute(loaded3);

    // Verify Order 1 is STILL completely unchanged
    const orderCheckAfterMsg3 = mockDb.orders.get(order1Id);
    assert.equal(orderCheckAfterMsg3.status, "CONFIRMED", "TEST 7: Order 1 status STILL CONFIRMED");
    assert.equal(orderCheckAfterMsg3.orderNumber, "ORD-NAWAZ-1", "TEST 7: Order 1 number intact");
    assert.equal(orderCheckAfterMsg3.items[0].quantity, 500, "TEST 7: Order 1 quantity intact");

    // Verify new requirement is created for flyers
    assert.ok(sales3.liveRequirement, "TEST 7: New liveRequirement exists for Order 2");
    assert.notEqual(sales3.liveRequirement._id, order1Id, "TEST 7: Order 2 does not share ID with Order 1");

    console.log("✅ TEST 7 PASSED\n");
  }

  console.log("=================================================");
  console.log("🎉 ALL 7 REQUIRED PRODUCTION TESTS PASSED PERFECTLY!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
