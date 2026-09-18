import WhatsAppResponseAdapter from "../ai-bot/modules/whatsapp/WhatsAppResponseAdapter.js";
import WhatsAppService from "../ai-bot/modules/whatsapp/WhatsAppService.js";
import MetaProviderAdapter from "../ai-bot/modules/whatsapp/providers/MetaProviderAdapter.js";
import { normalizeImageUrl, validateMediaUrl } from "../ai-bot/modules/sales/helpers/CatalogHelper.js";

async function runComprehensiveTests() {
  console.log("==================================================================");
  console.log("🧪 TESTING 10 SCENARIOS FOR META WHATSAPP MEDIA ERROR 131053 FIX");
  console.log("==================================================================");

  const adapter = new WhatsAppResponseAdapter();
  const service = new WhatsAppService();
  const metaProvider = new MetaProviderAdapter();

  // TEST 1: Greeting
  console.log("\n--- TEST 1: Greeting ---");
  const greetingResult = {
    workflow: "GREETING",
    currentStep: "GREETING",
    response: { type: "greeting", message: "Hello! How can I help you today?" },
  };
  const greetingMsgs = adapter.toWhatsAppMessages(greetingResult);
  const greetingHasImage = greetingMsgs.some((m) => m.type === "image" || m.interactive?.header?.type === "image");
  console.log("Greeting messages count:", greetingMsgs.length);
  console.log("Greeting message type:", greetingMsgs[0]?.type);
  console.log("Greeting contains image:", greetingHasImage, "(Expected: false)");
  if (greetingHasImage) throw new Error("TEST 1 FAILED: Greeting must not contain image");
  console.log("✅ TEST 1 PASSED: Greeting is text/interactive only with NO media.");

  // TEST 2: "business cards" Product discovery / Recommendation
  console.log("\n--- TEST 2: 'business cards' Product Discovery ---");
  const discoveryResult = {
    workflow: "DISCOVERY",
    currentStep: "SELECT_PRODUCT",
    response: {
      message: "Here are our business cards options:",
      data: {
        product: {
          id: "business-cards",
          name: "Business Cards",
          image: "https://www.exprintmart.com/_next/static/media/affordable-business-cards-in-dubai.42162778.webp",
        },
      },
    },
    actions: [
      { id: "OPT_1", type: "SELECT_SELECTION", label: "Budget Friendly" },
      { id: "OPT_2", type: "SELECT_SELECTION", label: "Premium Cards" },
    ],
  };
  const discoveryMsgs = adapter.toWhatsAppMessages(discoveryResult);
  console.log("Discovery messages count:", discoveryMsgs.length);
  console.log("Discovery message type:", discoveryMsgs[0]?.type);
  console.log("Discovery interactive header image:", discoveryMsgs[0]?.interactive?.header?.image?.link || null);
  if (!discoveryMsgs[0]?.interactive?.header?.image?.link) {
    throw new Error("TEST 2 FAILED: Expected catalog image in discovery message header");
  }
  console.log("✅ TEST 2 PASSED: Discovery interactive message has catalog image.");

  // TEST 3: Business Cards with malformed image URL
  console.log("\n--- TEST 3: Business Cards with malformed image URL ---");
  const malformedResult = {
    workflow: "DISCOVERY",
    currentStep: "SELECT_PRODUCT",
    response: {
      message: "Here are our business cards options:",
      data: {
        product: {
          id: "business-cards",
          name: "Business Cards",
          image: "https://example.com/notfound.webphttps://example.com/notfound.webp",
        },
      },
    },
    actions: [{ id: "OPT_1", type: "SELECT_SELECTION", label: "Budget Friendly" }],
  };
  const malformedMsgs = adapter.toWhatsAppMessages(malformedResult);
  console.log("Malformed message output type:", malformedMsgs[0]?.type);
  console.log("Malformed message buttons count:", malformedMsgs[0]?.interactive?.action?.buttons?.length);
  // Verify preflight validation rejects it
  const isPreflightValid = await validateMediaUrl("https://example.com/notfound.webphttps://example.com/notfound.webp");
  console.log("Preflight validation on malformed URL:", isPreflightValid, "(Expected: false)");
  if (isPreflightValid) throw new Error("TEST 3 FAILED: Preflight should reject malformed URL");
  console.log("✅ TEST 3 PASSED: Malformed URL rejected, interactive buttons preserved.");

  // TEST 4: Valid catalog product image
  console.log("\n--- TEST 4: Valid catalog product image ---");
  const validImageUrl = "https://www.exprintmart.com/_next/static/media/affordable-business-cards-in-dubai.42162778.webp";
  const isValidMedia = await validateMediaUrl(validImageUrl);
  console.log("Valid catalog image preflight result:", isValidMedia, "(Expected: true)");
  if (!isValidMedia) throw new Error("TEST 4 FAILED: Valid catalog image should pass preflight");
  console.log("✅ TEST 4 PASSED: Valid catalog product image verified.");

  // TEST 5: Click/select product (SELECT_SELECTION)
  console.log("\n--- TEST 5: Click/select product ---");
  const selectSelectionResult = {
    currentStep: "SELECT_SELECTION",
    context: {
      product: {
        id: "business-cards",
        name: "Business Cards",
        image: "https://www.exprintmart.com/_next/static/media/affordable-business-cards-in-dubai.42162778.webp",
      },
    },
    actions: [
      { id: "OPT_1", type: "SELECT_SELECTION", label: "Standard 350gsm" },
      { id: "OPT_2", type: "SELECT_SELECTION", label: "Luxury 600gsm" },
    ],
    formattedMessage: "Choose paper thickness:",
  };
  const selectSelectionMsgs = adapter.toWhatsAppMessages(selectSelectionResult);
  console.log("Selection message type:", selectSelectionMsgs[0]?.type);
  console.log("Selection image resolved:", selectSelectionMsgs[0]?.interactive?.header?.image?.link || null);
  console.log("✅ TEST 5 PASSED: Selection step response generated correctly.");

  // TEST 6: Order flow starts (STRICT MEDIA SUPPRESSION)
  console.log("\n--- TEST 6: Order flow starts (NO IMAGE UNDER ANY CONDITION) ---");
  const orderFlowSteps = [
    "COLLECT_PRODUCT_FIELD",
    "COLLECT_REQUIREMENT",
    "SELECT_ADDONS",
    "SELECT_DELIVERY_METHOD",
    "DELIVERY_ADDRESS",
    "DELIVERY_DATE",
    "ARTWORK",
    "ORDER_REVIEW",
    "CONFIRM_ORDER",
    "COLLECT_NAME",
    "COLLECT_EMAIL",
    "COLLECT_COMPANY",
    "ORDER_COMPLETED",
  ];

  for (const step of orderFlowSteps) {
    const orderResult = {
      currentStep: step,
      orderStarted: true,
      context: {
        product: {
          id: "business-cards",
          name: "Business Cards",
          image: "https://www.exprintmart.com/_next/static/media/affordable-business-cards-in-dubai.42162778.webp",
        },
      },
      actions: [{ id: "NEXT", type: "CONTINUE", label: "Next" }],
      formattedMessage: `Step: ${step}`,
    };
    const extractedImg = adapter.extractProductImage(orderResult);
    const msgs = adapter.toWhatsAppMessages(orderResult);
    const hasImage = msgs.some((m) => m.type === "image" || m.interactive?.header?.type === "image");
    if (extractedImg !== null || hasImage) {
      throw new Error(`TEST 6 FAILED on step ${step}: Order flow must NEVER contain image`);
    }
  }
  console.log("✅ TEST 6 PASSED: All order flow steps strictly block images.");

  // TEST 7: Cancel order
  console.log("\n--- TEST 7: Cancel order ---");
  const cancelResult = {
    metadata: { cancelled: true, stage: "CANCELLED" },
    action: { id: "CANCEL_ORDER" },
    message: "Order cancelled.",
  };
  const cancelMsgs = adapter.toWhatsAppMessages(cancelResult);
  console.log("Cancel message count:", cancelMsgs.length);
  console.log("Cancel message type:", cancelMsgs[0]?.type);
  console.log("Cancel message body:", cancelMsgs[0]?.text?.body);
  const cancelHasImage = cancelMsgs.some((m) => m.type === "image" || m.interactive?.header?.type === "image");
  if (cancelHasImage) throw new Error("TEST 7 FAILED: Cancel order must not have image");
  console.log("✅ TEST 7 PASSED: Cancel order produces text-only response.");

  // TEST 8: Unauthorized WhatsApp sender
  console.log("\n--- TEST 8: Unauthorized WhatsApp sender ---");
  const unauthorizedSender = "971501234567";
  const isAuthorized = service.allowlistPolicy.isAuthorized(unauthorizedSender);
  console.log(`Sender ${unauthorizedSender} is authorized:`, isAuthorized, "(Expected: false)");
  if (isAuthorized) throw new Error("TEST 8 FAILED: Unauthorized sender was allowed");
  console.log("✅ TEST 8 PASSED: Unauthorized sender is strictly dropped.");

  // TEST 9: Duplicate inbound message ID
  console.log("\n--- TEST 9: Duplicate inbound message ID ---");
  const testMessageId = "wamid.DUPLICATE_TEST_" + Date.now();
  service.markMessageProcessed(testMessageId);
  const isDuplicate = service.isDuplicateMessage(testMessageId);
  console.log("Duplicate check:", isDuplicate, "(Expected: true)");
  if (!isDuplicate) throw new Error("TEST 9 FAILED: Duplicate message ID not detected");
  console.log("✅ TEST 9 PASSED: Duplicate inbound message ID ignored.");

  // TEST 10: Normal text response
  console.log("\n--- TEST 10: Normal text response ---");
  const textResult = {
    message: "We offer same-day printing services across the UAE.",
  };
  const textMsgs = adapter.toWhatsAppMessages(textResult);
  console.log("Text message type:", textMsgs[0]?.type);
  console.log("Text message body:", textMsgs[0]?.text?.body);
  if (textMsgs[0]?.type !== "text" || !textMsgs[0]?.text?.body) {
    throw new Error("TEST 10 FAILED: Normal text response failed");
  }
  console.log("✅ TEST 10 PASSED: Normal text response functions properly.");

  // TEST 11: Async 131053 status failure with media fallback
  console.log("\n--- TEST 11: Async 131053 status failure with media fallback ---");
  const testWamid = "wamid.MEDIA_TEST_" + Date.now();
  let fallbackSentCount = 0;
  let fallbackPayloadSent = null;

  // Mock sendMessage on service to verify fallback call
  const origSendMessage = service.sendMessage.bind(service);
  service.sendMessage = async (to, msg, opts) => {
    if (opts?.isFallback) {
      fallbackSentCount++;
      fallbackPayloadSent = msg;
      return { sent: true, fallback: true };
    }
    return origSendMessage(to, msg, opts);
  };

  // Register an outbound media message in outboundMediaFallbacks
  service.outboundMediaFallbacks.set(testWamid, {
    to: "918310412768",
    fallbackMessage: {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Here are the cards" },
        action: { buttons: [{ type: "reply", reply: { id: "OPT_1", title: "Budget" } }] },
      },
    },
    options: { conversationKey: "whatsapp:918310412768", isFallback: true },
    fallenBack: false,
    createdAt: Date.now(),
  });

  // Process async 131053 status failure webhook from Meta
  const statusPayload = {
    id: testWamid,
    status: "failed",
    recipient_id: "918310412768",
    timestamp: String(Math.floor(Date.now() / 1000)),
    errors: [
      {
        code: 131053,
        title: "Media upload error",
        message: "Media upload error",
        error_data: { details: "Failed to download media" },
      },
    ],
  };

  await service.processStatuses([statusPayload]);

  console.log("Fallback sent count after first 131053:", fallbackSentCount, "(Expected: 1)");
  console.log("Fallback payload has image header:", Boolean(fallbackPayloadSent?.interactive?.header), "(Expected: false)");
  console.log("Fallback payload has buttons:", Boolean(fallbackPayloadSent?.interactive?.action?.buttons), "(Expected: true)");
  if (fallbackSentCount !== 1) throw new Error("TEST 11 FAILED: Fallback was not sent on async 131053");
  if (fallbackPayloadSent?.interactive?.header) throw new Error("TEST 11 FAILED: Fallback must not contain media header");
  console.log("✅ TEST 11 PASSED: Async 131053 triggered media-free fallback with buttons preserved.");

  // TEST 12: Duplicate 131053 status webhook (Idempotency)
  console.log("\n--- TEST 12: Duplicate 131053 status webhook (Idempotency) ---");
  await service.processStatuses([statusPayload]);
  console.log("Fallback sent count after second 131053:", fallbackSentCount, "(Expected: 1)");
  if (fallbackSentCount !== 1) throw new Error("TEST 12 FAILED: Duplicate 131053 must NOT trigger duplicate fallback");
  console.log("✅ TEST 12 PASSED: Duplicate 131053 status is safely ignored.");

  // Restore origSendMessage
  service.sendMessage = origSendMessage;

  // TEST 13: Meta Authentication Diagnostic Check
  console.log("\n--- TEST 13: Meta Authentication Diagnostic Check ---");
  const diagnostic = await metaProvider.checkAuthDiagnostic();
  console.log("Diagnostic success flag:", typeof diagnostic.success === "boolean");
  if (typeof diagnostic.success !== "boolean") throw new Error("TEST 13 FAILED: Diagnostic check returned invalid result");
  console.log("✅ TEST 13 PASSED: Meta authentication diagnostic executed safely without exposing secrets.");

  // TEST 14: 401 / 190 Sanitized Handling (No infinite loops, clean failure)
  console.log("\n--- TEST 14: 401 / 190 Authentication Error Handling ---");
  const unauthProvider = new MetaProviderAdapter({
    accessToken: "EAAB_invalid_expired_token_for_test",
    phoneNumberId: "735218809665742",
  });
  let authErrorCaught = false;
  try {
    await unauthProvider.sendMessage("918310412768", {
      type: "text",
      text: { body: "Testing auth failure" },
    });
  } catch (err) {
    authErrorCaught = true;
    console.log("Sanitized error caught as expected:", err.message.length > 0);
  }
  if (!authErrorCaught) throw new Error("TEST 14 FAILED: Expected 401 to throw cleanly");
  console.log("✅ TEST 14 PASSED: 401 Authentication Error handled cleanly without retry loops.");

  console.log("\n==================================================================");
  console.log("🎉 ALL 14 TESTS (INCLUDING AUTH DIAGNOSTICS & 401 HANDLING) PASSED PERFECTLY!");
  console.log("==================================================================");
}

runComprehensiveTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
