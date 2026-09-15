/**
 * WhatsAppService.js
 *
 * Canonical WhatsApp Gateway Orchestration Layer for ExprintMart AI Backend.
 *
 * Thin provider-neutral transport orchestration:
 * 1. Webhook receiving & HMAC/token authentication
 * 2. Provider normalization (Whapi.Cloud & Meta WhatsApp Cloud API)
 * 3. Authoritative inbound single-sender allowlist gate
 * 4. Inbound event deduplication
 * 5. Per-session concurrency serialization
 * 6. Session & window policy recording
 * 7. AI conversation graph dispatch
 * 8. Outbound response formatting & delivery
 * 9. Safe, isolated error handling
 */

import crypto from "crypto";
import AIService from "../../../services/AIService.js";
import WhatsAppMessageParser from "./WhatsAppMessageParser.js";
import WhatsAppResponseAdapter from "./WhatsAppResponseAdapter.js";
import WhatsAppMediaService from "./WhatsappMediaService.js";
import WhatsAppApiService from "./services/WhatsAppApiService.js";
import WhatsAppCustomerServiceWindowPolicy from "./policies/WhatsAppCustomerServiceWindowPolicy.js";
import WhatsAppOutboundPolicy from "./policies/WhatsAppOutboundPolicy.js";
import WhatsappActionCodec from "./WhatsappActionCodec.js";
import ConversationDecisionService from "../sales/services/ConversationDecisionService.js";
import ConversationRepository from "../../repositories/ConversationRepository.js";
import WhatsAppRealtimeService, {
  WhatsAppEvents,
} from "./services/WhatsAppRealtimeService.js";
import WhatsAppProviderFactory from "./providers/WhatsAppProviderFactory.js";
import WhatsAppFlowSubmissionService from "./flows/WhatsAppFlowSubmissionService.js";
import WhatsAppAllowlistPolicy from "./policies/WhatsAppAllowlistPolicy.js";
import WhatsAppSessionService from "./WhatsAppSessionService.js";

export default class WhatsAppService {
  constructor(
    apiService = null,
    windowPolicy = null,
    outboundPolicy = null,
    mediaService = null,
    conversationRepository = null,
    realtimeService = null,
    aiServiceInstance = null,
    provider = null,
  ) {
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    this.appSecret = process.env.WHATSAPP_APP_SECRET;
    this.whapiToken = process.env.WHAPI_TOKEN;
    this.whapiWebhookSecret = process.env.WHAPI_WEBHOOK_SECRET;

    this.provider = provider || WhatsAppProviderFactory.getProvider();
    this.apiService =
      apiService || new WhatsAppApiService({ provider: this.provider });

    this.windowPolicy =
      windowPolicy || new WhatsAppCustomerServiceWindowPolicy();

    this.outboundPolicy =
      outboundPolicy ||
      new WhatsAppOutboundPolicy({
        windowPolicy: this.windowPolicy,
      });

    this.mediaService =
      mediaService || new WhatsAppMediaService(this.apiService);

    this.conversationRepository =
      conversationRepository || new ConversationRepository();

    this.realtimeService =
      realtimeService || WhatsAppRealtimeService.getInstance();

    this.aiService = aiServiceInstance || new AIService();
    this.messageParser = new WhatsAppMessageParser();
    this.responseAdapter = new WhatsAppResponseAdapter();

    this.allowlistPolicy = new WhatsAppAllowlistPolicy();
    this.sessionService = new WhatsAppSessionService(this.allowlistPolicy);

    this.flowSubmissionService = new WhatsAppFlowSubmissionService({
      conversationRepository: this.conversationRepository,
    });

    this.processedMessageIds = new Set();
    this.maxProcessedMessageIds = 5000;
    this.lastAvailableActions = new Map();
    this.maxTrackedSessions = 5000;
    this.sessionQueues = new Map();
  }

  // =====================================================
  // SESSION CONCURRENCY QUEUE
  // =====================================================

  enqueueSessionTask(sessionId, fn) {
    if (!sessionId || typeof fn !== "function") {
      return typeof fn === "function" ? fn() : Promise.resolve();
    }
    const previousPromise =
      this.sessionQueues.get(sessionId) || Promise.resolve();
    const nextPromise = previousPromise
      .catch((err) => {
        console.error(
          `[WhatsAppService] Queued session task error for ${sessionId}:`,
          err?.message,
        );
      })
      .then(() => fn())
      .finally(() => {
        if (this.sessionQueues.get(sessionId) === nextPromise) {
          this.sessionQueues.delete(sessionId);
        }
      });

    this.sessionQueues.set(sessionId, nextPromise);
    return nextPromise;
  }

  setAvailableActions(key, actions) {
    if (!key) return;
    if (this.lastAvailableActions.size >= this.maxTrackedSessions) {
      const oldestKey = this.lastAvailableActions.keys().next().value;
      if (oldestKey) this.lastAvailableActions.delete(oldestKey);
    }
    this.lastAvailableActions.set(key, actions);
  }

  // =====================================================
  // IDEMPOTENCY / DUPLICATE PROTECTION
  // =====================================================

  isDuplicateMessage(messageId) {
    if (!messageId) return false;
    return this.processedMessageIds.has(String(messageId));
  }

  markMessageProcessed(messageId) {
    if (!messageId) return;
    if (this.processedMessageIds.size >= this.maxProcessedMessageIds) {
      const firstItem = this.processedMessageIds.values().next().value;
      if (firstItem) this.processedMessageIds.delete(firstItem);
    }
    this.processedMessageIds.add(String(messageId));
  }

  // =====================================================
  // WEBHOOK VERIFICATION & AUTHENTICATION
  // =====================================================

  verifyWebhook(mode, token, challenge) {
    if (mode !== "subscribe") return false;
    const verifyToken = this.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken || !token || !challenge) return false;
    if (token !== verifyToken) {
      console.error("[WhatsApp] Webhook verification token mismatch.");
      return false;
    }
    return challenge;
  }

  verifySignature(rawBody, signature) {
    const appSecret = this.appSecret || process.env.WHATSAPP_APP_SECRET;
    if (!appSecret || !rawBody || !signature) return false;

    try {
      const cleanSignature = signature.startsWith("sha256=")
        ? signature.slice(7)
        : signature;

      const expectedHex = crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

      const expectedBuffer = Buffer.from(expectedHex, "utf8");
      const receivedBuffer = Buffer.from(cleanSignature, "utf8");

      if (expectedBuffer.length !== receivedBuffer.length) return false;
      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (err) {
      console.error("[WhatsApp] Signature verification error:", err.message);
      return false;
    }
  }

  // =====================================================
  // WEBHOOK EVENT INGESTION (POST)
  // =====================================================

  async handleWebhook(body = {}, authContext = {}) {
    if (!body || typeof body !== "object") return;

    const correlationId =
      authContext?.correlationId || `req_${Date.now().toString(36)}`;
    const providerName =
      authContext?.provider ||
      (body.object === "whatsapp_business_account"
        ? "meta"
        : this.provider?.name || "whapi");

    const activeProvider =
      this.provider?.name === providerName
        ? this.provider
        : WhatsAppProviderFactory.getProvider(providerName);

    const payloadKeys = Object.keys(body).join(",");
    console.log(
      `[WhatsApp][Service] correlationId=${correlationId} handleWebhook start provider=${activeProvider.name} payloadKeys=${payloadKeys}`,
    );

    const normalizedEvents = activeProvider.normalizeInbound(
      body,
      authContext,
      authContext?.headers || {},
    );

    if (Array.isArray(normalizedEvents) && normalizedEvents.length > 0) {
      console.log(
        `[WhatsApp][Normalize] correlationId=${correlationId} provider=${activeProvider.name} count=${normalizedEvents.length} types=${normalizedEvents.map((e) => e.eventType).join(",")}`,
      );

      for (const event of normalizedEvents) {
        if (event.eventType === "STATUS") {
          await this.processStatuses([event.rawProviderEvent || event]);
        } else {
          await this.processNormalizedEvent(event, {
            ...authContext,
            correlationId,
          });
        }
      }
      return;
    }

    console.warn(
      `[WhatsApp][Normalize] correlationId=${correlationId} provider=${activeProvider.name} returned 0 normalized events from payload (payloadKeys=${payloadKeys})`,
    );

    // Fallback for raw Meta webhook structure if provider returned empty
    if (body.object === "whatsapp_business_account") {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      for (const entry of entries) {
        await this.processEntry(entry);
      }
    }
  }

  // =====================================================
  // INBOUND EVENT ORCHESTRATION PIPELINE
  // =====================================================

  async processNormalizedEvent(event = {}, authContext = {}) {
    if (!event) return;

    const customerWaId = event.customerWaId;
    if (!this.allowlistPolicy.isAuthorized(customerWaId)) {
      const maskedPhone = this.allowlistPolicy.maskPhone(customerWaId);
      console.log(
        `[WhatsApp Inbound Gate] Inbound message from non-allowlisted sender ${maskedPhone} rejected. Automation halted.`,
      );
      if (event.messageId) this.markMessageProcessed(event.messageId);
      return;
    }

    const sessionDigits =
      this.allowlistPolicy.normalizeToSessionDigits(customerWaId) ||
      customerWaId;
    const sessionQueueKey = `whatsapp:${sessionDigits}`;
    return this.enqueueSessionTask(sessionQueueKey, () =>
      this._processNormalizedEventInternal(event, authContext),
    );
  }

  async processEvent(event, authContext = {}) {
    return this.processNormalizedEvent(event, authContext);
  }

  async _processNormalizedEventInternal(event = {}, authContext = {}) {
    if (!event || !event.customerWaId) return;

    const messageId = event.messageId;
    const customerWaId = event.customerWaId;
    const provider = event.provider || this.provider?.name || "whapi";
    const correlationId = authContext?.correlationId || crypto.randomUUID();
    const sanitizedPhone = this.allowlistPolicy.maskPhone(customerWaId);

    console.log(
      `[WhatsApp][Inbound] correlationId=${correlationId} received messageId=${messageId} sender=${sanitizedPhone} provider=${provider}`,
    );

    // 1. Duplicate event check
    const isDuplicate = this.isDuplicateMessage(messageId);
    console.log(
      `[WhatsApp][Duplicate] correlationId=${correlationId} messageId=${messageId} duplicate=${isDuplicate}`,
    );

    if (messageId && isDuplicate) {
      console.log(
        `[${provider === "whapi" ? "Whapi Interactive" : "WhatsApp"}] DUPLICATE_EVENT_IGNORED:`,
        { correlationId, messageId },
      );
      return;
    }

    if (!messageId) {
      console.warn("[WhatsApp] Inbound event missing messageId. Dropping.");
      return;
    }

    // 2. Authoritative allowlist gate check
    if (!this.allowlistPolicy.isAuthorized(customerWaId)) {
      console.log(
        `[WhatsApp Inbound Gate] Sender ${sanitizedPhone} not in allowlist. Dropping event.`,
      );
      this.markMessageProcessed(messageId);
      return;
    }

    this.markMessageProcessed(messageId);

    const receivedAt = Date.now();
    const customerTimestamp = event.timestamp || receivedAt;
    const phoneNumberId = event.phoneNumberId || this.apiService?.phoneNumberId;

    // 3. Customer Service Window & session isolation
    const sessionDigits =
      this.allowlistPolicy.normalizeToSessionDigits(customerWaId) ||
      customerWaId;
    const sessionId = this.sessionService.buildSessionId(
      sessionDigits,
      phoneNumberId,
    );

    this.windowPolicy.recordInboundCustomerMessage(
      customerWaId,
      customerTimestamp,
    );
    this.windowPolicy.recordInboundCustomerMessage(
      sessionId,
      customerTimestamp,
    );

    const inboundTriggerContext = {
      triggeredByInboundMessage: true,
      inboundMessageId: messageId,
      customerWaId,
      phoneNumberId,
      inboundReceivedAt: customerTimestamp,
      authenticated: authContext?.authenticated !== false,
      provider,
      isFlowSubmission: event.isFlowSubmission === true,
      flowValid: event.flow?.valid !== false,
    };

    console.log("[WhatsApp] Inbound customer message received:", {
      correlationId,
      messageId,
      customerWaId,
      phoneNumberId,
      type: event.messageType || event.eventType,
      sessionId,
      provider,
    });

    // 4. Persist inbound message to MongoDB
    const persistedInboundMessage = {
      messageId: crypto.randomUUID(),
      role: "user",
      content:
        event.text ||
        (event.attachments?.length
          ? `[Media: ${event.attachments[0].mimeType || "attachment"}]`
          : event.messageType || "message"),
      timestamp: new Date(customerTimestamp),
      whatsappMessageId: messageId,
      direction: "inbound",
      senderType: "customer",
      messageType: event.messageType || "text",
      status: "received",
      mediaId: event.attachments?.[0]?.mediaId || null,
      interactiveData: event.action || event.interactive || null,
      flowData: event.flow || null,
    };

    let conv = null;
    try {
      conv = await this.conversationRepository.findBySessionId(sessionId);
      if (!conv) {
        conv = await this.conversationRepository.createConversation({
          sessionId,
          visitorId: sessionId,
          channel: "WHATSAPP",
          customerWaId,
          lastUserMessageAt: new Date(customerTimestamp),
          lastInboundMessageId: messageId,
          customer: { name: event.fromName || null, phone: customerWaId },
          metadata: { phoneNumberId },
        });
      } else {
        await this.conversationRepository.updateConversation(sessionId, {
          channel: "WHATSAPP",
          customerWaId,
          lastUserMessageAt: new Date(customerTimestamp),
          lastInboundMessageId: messageId,
          "metadata.phoneNumberId": phoneNumberId,
        });
      }
      await this.conversationRepository.addMessage(
        sessionId,
        persistedInboundMessage,
      );
    } catch (err) {
      // Non-fatal if DB is offline in unit tests
    }

    // 5. CRM Realtime event emissions
    this.realtimeService.emitEvent(WhatsAppEvents.MESSAGE_RECEIVED, {
      sessionId,
      customerWaId,
      phoneNumberId,
      message: persistedInboundMessage,
    });
    this.realtimeService.emitEvent(WhatsAppEvents.CONVERSATION_UPDATED, {
      sessionId,
      customerWaId,
      lastUserMessageAt: customerTimestamp,
      lastInboundMessageId: messageId,
    });

    // 6. Resolve media attachments
    let resolvedAttachments = event.attachments || [];
    if (resolvedAttachments.length > 0) {
      resolvedAttachments =
        await this.mediaService.resolveAttachments(resolvedAttachments);
    }

    // 7. Fast-Path: Deterministic Flow Submission Handler
    if (
      event.isFlowSubmission === true ||
      event.eventType === "FLOW_SUBMISSION"
    ) {
      const flowData =
        event.flow?.responseJson ||
        event.interactive?.payload ||
        event.action?.payload?.responseJson ||
        {};
      const flowToken =
        event.flow?.flowToken || event.action?.payload?.flowToken || null;

      const flowResult = await this.flowSubmissionService.handleFlowSubmission({
        flowData,
        flowToken,
        messageId,
        customerWaId,
        correlationId,
      });

      if (flowResult && flowResult.response) {
        await this.sendResult(
          {
            sessionId,
            whatsapp: { phoneNumber: customerWaId, phoneNumberId, messageId },
            inboundTriggerContext,
          },
          flowResult.response,
          { inboundTriggerContext, receivedAt, correlationId },
        );
        return;
      } else if (flowResult && flowResult.userMessage) {
        await this.sendMessage(
          customerWaId,
          { type: "text", text: { body: flowResult.userMessage } },
          { inboundTriggerContext, conversationKey: customerWaId, sessionId },
        );
        return;
      }
    }

    // 8. Action extraction and security validation
    const availableActions = this.extractAvailableActions(
      conv,
      sessionId,
      customerWaId,
    );

    let finalAction = event.action || null;
    let finalEventType = event.eventType || "MESSAGE";

    if (finalAction) {
      const validation = this.validateActionAgainstCurrentState(
        finalAction,
        availableActions,
        conv,
      );

      if (!validation.valid && validation.reason === "FORGED_OR_STALE_ACTION") {
        console.log("[WhatsApp] ACTION_REJECTED:", {
          actionId: finalAction.id,
          reason: validation.reason,
          customerWaId,
        });
        finalAction = null;
        finalEventType = "MESSAGE";
      } else if (validation.matchedAction) {
        finalAction = {
          id: validation.matchedAction.id || validation.matchedAction.type,
          type: validation.matchedAction.type || validation.matchedAction.id,
          label:
            validation.matchedAction.label ||
            validation.matchedAction.title ||
            validation.matchedAction.name ||
            finalAction.label ||
            finalAction.id,
          payload: {
            ...(validation.matchedAction.payload || {}),
            ...(finalAction.payload || {}),
          },
        };
        console.log("[WhatsApp] ACTION_RESOLVED:", {
          actionId: finalAction.id,
          type: finalAction.type,
          payload: finalAction.payload,
        });
      }
    } else if (event.text && typeof event.text === "string") {
      // Deterministic numeric / text choice matching ("1", "2", "standard")
      if (availableActions && availableActions.length > 0) {
        const resolved = this.resolveTextAction(event.text, availableActions);
        if (resolved) {
          finalAction = {
            id: resolved.id || resolved.type,
            type: resolved.type || resolved.id,
            label: resolved.label || resolved.title || resolved.name,
            payload: {
              ...(resolved.payload || {}),
              label: resolved.label || resolved.title || resolved.name,
            },
          };
          finalEventType = "ACTION";
          console.log("[WhatsApp] ACTION_RESOLVED:", {
            text: event.text,
            actionId: finalAction.id,
            type: finalAction.type,
            payload: finalAction.payload,
          });
        }
      }
    }

    // 9. Build incoming payload for AI conversation graph
    console.log(
      `[WhatsApp][Process] messageId=${messageId} sessionId=${sessionId}`,
    );

    const incoming = {
      sessionId,
      visitorId: sessionId,
      site: "exprintmart",
      visitor: { name: event.fromName || null, phone: customerWaId },
      channel: "WHATSAPP",
      whatsapp: {
        phoneNumber: customerWaId,
        phoneNumberId,
        messageId,
        timestamp: customerTimestamp,
      },
      ipAddress: null,
      initiatedByCustomer: true,
      message: event.text || (finalAction ? String(finalAction.id) : ""),
      action: finalAction,
      attachments: resolvedAttachments,
      eventType: finalEventType,
      isFlowSubmission: event.isFlowSubmission === true,
      flow: event.flow || null,
      inboundTriggerContext,
      originalMessage: event.rawProviderEvent,
    };

    // 10. AI Service conversation processing
    try {
      const processingStartedAt = Date.now();
      console.log(
        `[WhatsApp][AI] correlationId=${correlationId} START messageId=${messageId}`,
      );
      const result = await this.aiService.chat(incoming);
      console.log(
        `[WhatsApp][AI] correlationId=${correlationId} END messageId=${messageId}`,
      );
      const responseGeneratedAt = Date.now();
      const processingLatencyMs = responseGeneratedAt - receivedAt;

      console.log(
        `[WhatsApp][Outbound] correlationId=${correlationId} messageId=${messageId} response generated in ${processingLatencyMs}ms`,
      );

      await this.sendResult(incoming, result, {
        inboundTriggerContext,
        receivedAt,
        processingStartedAt,
        responseGeneratedAt,
        processingLatencyMs,
      });
    } catch (err) {
      console.error("[WhatsApp] Error during AI conversation processing:", {
        correlationId,
        messageId,
        error: err.message,
      });
      this.processedMessageIds.delete(String(messageId));
    }
  }

  // =====================================================
  // DIRECT RAW MESSAGE PROCESSING (DELEGATION TO PIPELINE)
  // =====================================================

  async processMessage({
    message,
    metadata = {},
    contacts = [],
    authContext = {},
  }) {
    if (!message) return;
    if (!this.messageParser.isSupported(message)) {
      console.log("[WhatsApp] Unsupported message type:", message?.type);
      return;
    }

    const incoming = this.messageParser.parse({ message, metadata, contacts });
    if (!incoming || !incoming.whatsapp?.phoneNumber) return;

    const customerWaId = incoming.whatsapp.phoneNumber;
    const messageId = message.id || incoming.whatsapp.messageId;
    const timestamp = message.timestamp
      ? Number(message.timestamp) * 1000
      : Date.now();
    const phoneNumberId =
      metadata?.phone_number_id || this.apiService?.phoneNumberId;
    const provider =
      message?.provider || (process.env.WHAPI_TOKEN ? "whapi" : "meta");

    const normalizedEvent = {
      provider,
      eventType: incoming.eventType || "MESSAGE",
      messageType: message.type || "text",
      messageId,
      customerWaId,
      phoneNumberId,
      timestamp,
      text: incoming.message || null,
      action: incoming.action || null,
      attachments: incoming.attachments || [],
      fromName: incoming.visitor?.name || null,
      rawProviderEvent: message,
      isFlowSubmission: incoming.isFlowSubmission === true,
      flow: incoming.flow || null,
    };

    return this.processNormalizedEvent(normalizedEvent, authContext);
  }

  async processEntry(entry = {}) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      await this.processChange(change);
    }
  }

  async processChange(change = {}) {
    if (change?.field !== "messages") return;
    const value = change?.value || {};
    if (Array.isArray(value.statuses)) {
      await this.processStatuses(value.statuses);
    }
    if (!Array.isArray(value.messages) || value.messages.length === 0) return;

    for (const message of value.messages) {
      try {
        await this.processMessage({
          message,
          metadata: value.metadata || {},
          contacts: value.contacts || [],
        });
      } catch (error) {
        console.error("[WhatsApp] Message processing error:", error.message);
      }
    }
  }

  async processWhapiPayload(body = {}, authContext = {}) {
    const whapiAdapter = WhatsAppProviderFactory.getProvider("whapi");
    const events = whapiAdapter.normalizeInbound(body, authContext);
    for (const event of events) {
      if (event.eventType === "STATUS") {
        await this.processStatuses([event.rawProviderEvent || event]);
      } else {
        await this.processNormalizedEvent(event, authContext);
      }
    }
  }

  // =====================================================
  // OUTBOUND DISPATCH & RESULT DELIVERY
  // =====================================================

  async sendResult(incoming, result, timing = {}) {
    const inboundTriggerContext =
      timing.inboundTriggerContext || incoming?.inboundTriggerContext;

    const conversationKey =
      incoming?.whatsapp?.phoneNumber || incoming?.sessionId;

    const targetSessionId =
      incoming?.sessionId ||
      `whatsapp:${incoming?.whatsapp?.phoneNumber}`;

    const isCancelled =
      result?.metadata?.cancelled === true ||
      result?.response?.metadata?.cancelled === true ||
      result?.metadata?.stage === "CANCELLED" ||
      result?.response?.metadata?.stage === "CANCELLED" ||
      result?.action?.id === "CANCEL_ORDER" ||
      result?.response?.action?.id === "CANCEL_ORDER";

    // =====================================================
    // CANCELLATION = HARD RESET
    // =====================================================
    if (isCancelled) {
      console.log(
        `[CANCEL][OUTBOUND][RESET] session=${targetSessionId}`,
      );

      // Remove stale interactive actions from memory.
      this.lastAvailableActions.delete(targetSessionId);

      if (incoming?.whatsapp?.phoneNumber) {
        this.lastAvailableActions.delete(
          incoming.whatsapp.phoneNumber,
        );
      }

      // Never allow stale result data to reach the normal
      // product/image/interactive-message pipeline.
      result = {
        ...result,

        workflow: "NONE",
        currentStep: null,
        nextStep: null,

        action: null,
        actions: [],

        liveRequirement: null,
        order: null,
        orderContext: null,
        product: null,
        productId: null,
        selectedProduct: null,
        selectedProductId: null,
        selection: null,
        selectionId: null,

        attachments: [],
        mediaContext: null,
        discoveryMatches: [],

        metadata: {
          ...(result?.metadata ?? {}),
          stage: "CANCELLED",
          cancelled: true,
          product: null,
          selectedProduct: null,
          selection: null,
          image: null,
          images: [],
          attachments: [],
        },

        response: {
          ...(result?.response ?? {}),
          workflow: "NONE",
          currentStep: null,
          nextStep: null,
          action: null,
          actions: [],
          liveRequirement: null,

          metadata: {
            ...(result?.response?.metadata ?? {}),
            stage: "CANCELLED",
            cancelled: true,
            product: null,
            selectedProduct: null,
            selection: null,
            image: null,
            images: [],
            attachments: [],
          },
        },
      };

      console.log("[CANCEL][OUTBOUND][MEDIA_BLOCKED]");
    } else {
      // =====================================================
      // NORMAL ACTION CACHE
      // =====================================================
      const actions = this.responseAdapter.extractActions(result);

      if (actions?.length > 0) {
        this.setAvailableActions(targetSessionId, actions);

        if (incoming?.whatsapp?.phoneNumber) {
          this.setAvailableActions(
            incoming.whatsapp.phoneNumber,
            actions,
          );
        }
      }
    }

    // =====================================================
    // BUILD OUTBOUND WHATSAPP MESSAGES
    // =====================================================
    const outboundWorkflow =
      result?.workflow ??
      result?.response?.workflow ??
      incoming?.workflow ??
      null;

    const outgoingMessages =
      this.responseAdapter.toWhatsAppMessages({
        ...result,

        workflow: outboundWorkflow,

        sessionId:
          result?.sessionId ??
          incoming?.sessionId ??
          null,

        visitorId:
          result?.visitorId ??
          incoming?.visitorId ??
          null,

        whatsapp:
          result?.whatsapp ??
          incoming?.whatsapp ??
          null,

        liveRequirement:
          result?.liveRequirement ?? null,
      });

    if (isCancelled) {
      console.log(
        `[CANCEL][OUTBOUND] messages=${outgoingMessages.length}`,
      );
    }

    const sendResults = [];

    for (const outgoing of outgoingMessages) {
      try {
        const sendRes = await this.sendMessage(
          incoming.whatsapp.phoneNumber,
          outgoing,
          {
            inboundTriggerContext,
            conversationKey,
            sessionId: incoming?.sessionId,
            timing,
          },
        );

        sendResults.push(sendRes);
      } catch (err) {
        console.error(
          "[WhatsApp] Outbound message send failure:",
          {
            to: incoming.whatsapp?.phoneNumber,
            type: outgoing?.type,
            error: err.message,
          },
        );
      }
    }

    return sendResults;
  }

  async sendMessage(to, message, options = {}) {
    const now = options.now !== undefined ? options.now : Date.now();
    const inboundTriggerContext = options.inboundTriggerContext || {
      triggeredByInboundMessage: false,
    };
    const conversationKey =
      options.conversationKey ||
      options.sessionId ||
      inboundTriggerContext.customerWaId ||
      to;

    const lastUserMessageAt =
      options.lastUserMessageAt !== undefined
        ? options.lastUserMessageAt
        : this.windowPolicy.getLastUserMessageAt(conversationKey) ||
        inboundTriggerContext.inboundReceivedAt;

    // Outbound hard policy authorization guard
    const authorization = this.outboundPolicy.authorizeOutbound({
      to,
      message,
      inboundTriggerContext,
      lastUserMessageAt,
      now,
      credentials: {
        accessToken: this.apiService?.accessToken,
        phoneNumberId: this.apiService?.phoneNumberId,
        whapiToken: this.whapiToken,
      },
    });

    if (authorization.blocked) {
      console.warn("[WhatsApp] OUTBOUND_BLOCKED:", {
        reason: authorization.reason,
        conversationId: conversationKey,
        recipient: to,
        inboundMessageId: inboundTriggerContext?.inboundMessageId ?? null,
        lastUserMessageAt,
        windowExpiresAt: authorization.windowExpiresAt,
        currentTime: now,
        windowRemainingMs: authorization.windowRemainingMs,
        processingLatencyMs: options.timing?.processingLatencyMs ?? null,
      });

      return {
        sent: false,
        blocked: true,
        reason: authorization.reason,
        windowRemainingMs: authorization.windowRemainingMs,
      };
    }

    console.log("[WhatsApp] OUTBOUND_DISPATCH:", {
      recipient: to,
      type: message?.type,
      provider: inboundTriggerContext?.provider || this.provider?.name,
    });

    const activeProvider =
      inboundTriggerContext?.provider &&
        inboundTriggerContext.provider !== this.provider?.name
        ? WhatsAppProviderFactory.getProvider(inboundTriggerContext.provider)
        : this.provider;

    const isFlowMessage =
      message?.type === "interactive" && message.interactive?.type === "flow";

    const apiResult = isFlowMessage
      ? this.apiService
        ? await this.apiService.sendFlow(to, message, options)
        : await activeProvider.sendFlow(to, message, options)
      : this.apiService
        ? await this.apiService.sendMessage(to, message, options)
        : await activeProvider.sendMessage(to, message, options);

    const responseSentAt = Date.now();
    const totalLatencyMs = options.timing?.receivedAt
      ? responseSentAt - options.timing.receivedAt
      : null;

    const metaWamid = apiResult?.messages?.[0]?.id || null;
    const senderType =
      options.senderType ||
      (inboundTriggerContext.senderType === "agent" ? "agent" : "ai");

    let contentText = "";
    if (message?.text?.body) {
      contentText = message.text.body;
    } else if (message?.interactive?.body?.text) {
      contentText = message.interactive.body.text;
    } else if (message?.type === "image") {
      contentText = message.image?.caption || message.caption || "[Image]";
    } else if (typeof message?.content === "string") {
      contentText = message.content;
    } else {
      contentText = `[WhatsApp ${message?.type || "message"}]`;
    }

    const persistedOutboundMessage = {
      messageId: crypto.randomUUID(),
      role: "assistant",
      content: contentText,
      timestamp: new Date(responseSentAt),
      whatsappMessageId: metaWamid,
      direction: "outbound",
      senderType,
      messageType: message?.type || "text",
      status: "sent",
      mediaId: message?.image?.id || message?.document?.id || null,
      mediaUrl: message?.image?.link || message?.image?.url || null,
      interactiveData: message?.interactive || null,
      flowData: message?.interactive?.action?.parameters || null,
    };

    const targetSessionId =
      options.sessionId ||
      (options.conversationKey?.startsWith("whatsapp:")
        ? options.conversationKey
        : `whatsapp:${to}`);

    try {
      await this.conversationRepository.addMessage(
        targetSessionId,
        persistedOutboundMessage,
      );
    } catch (err) {
      // Non-fatal if DB is disconnected
    }

    this.realtimeService.emitEvent(WhatsAppEvents.MESSAGE_SENT, {
      sessionId: targetSessionId,
      recipient: to,
      wamid: metaWamid,
      message: persistedOutboundMessage,
      apiResult,
    });
    this.realtimeService.emitEvent(WhatsAppEvents.CONVERSATION_UPDATED, {
      sessionId: targetSessionId,
      recipient: to,
    });

    return {
      sent: true,
      blocked: false,
      reason: null,
      windowRemainingMs: authorization.windowRemainingMs,
      totalLatencyMs,
      result: apiResult,
      persistedMessage: persistedOutboundMessage,
    };
  }

  // =====================================================
  // CONVENIENCE MESSAGING APIS
  // =====================================================

  async sendTextMessage(to, body, options = {}) {
    return this.sendMessage(
      to,
      { type: "text", text: { preview_url: false, body } },
      options,
    );
  }

  async sendText(to, body, options = {}) {
    return this.sendTextMessage(to, body, options);
  }

  async sendImageMessage(to, imageUrl, caption = "", options = {}) {
    return this.sendMessage(
      to,
      {
        type: "image",
        image: {
          link: imageUrl,
          ...(caption ? { caption: String(caption).trim() } : {}),
        },
      },
      options,
    );
  }

  async sendButtonMessage(
    to,
    bodyText,
    buttons = [],
    header = null,
    footer = null,
    options = {},
  ) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b, index) => ({
            type: "reply",
            reply: {
              id: b.id ?? `btn_${index}`,
              title: String(b.title ?? b.label ?? `Option ${index + 1}`)
                .trim()
                .slice(0, 20),
            },
          })),
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };
    return this.sendMessage(to, payload, options);
  }

  async sendListMessage(
    to,
    bodyText,
    buttonText,
    sections = [],
    header = null,
    footer = null,
    options = {},
  ) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: String(buttonText || "Choose Option")
            .trim()
            .slice(0, 20),
          sections: sections.map((sec) => ({
            title: String(sec.title || "Options")
              .trim()
              .slice(0, 24),
            rows: (sec.rows || []).map((row, rIdx) => ({
              id: row.id ?? `row_${rIdx}`,
              title: String(row.title ?? row.label ?? `Item ${rIdx + 1}`)
                .trim()
                .slice(0, 24),
              ...(row.description
                ? { description: String(row.description).trim().slice(0, 72) }
                : {}),
            })),
          })),
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };
    return this.sendMessage(to, payload, options);
  }

  async sendFlowMessage(
    to,
    bodyText,
    flowParams = {},
    header = null,
    footer = null,
    options = {},
  ) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: bodyText },
        action: { name: "flow", parameters: flowParams },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };
    return this.sendMessage(to, payload, options);
  }

  // =====================================================
  // CRM HUMAN AGENT MESSAGE DISPATCH
  // =====================================================

  async sendAgentMessage({
    sessionId,
    message,
    agentId = null,
    now = Date.now(),
  }) {
    if (!sessionId || !sessionId.trim()) {
      throw new Error(
        "sessionId is required for CRM WhatsApp message dispatch.",
      );
    }
    if (!message || !message.trim()) {
      throw new Error("message text is required.");
    }

    const conversation = await this.conversationRepository.findBySessionId(
      sessionId.trim(),
    );
    if (!conversation) {
      return {
        sent: false,
        blocked: true,
        reason: "CONVERSATION_NOT_FOUND",
      };
    }

    if (conversation.channel !== "WHATSAPP") {
      return { sent: false, blocked: true, reason: "INVALID_CHANNEL" };
    }

    const customerWaId = conversation.customerWaId;
    if (!customerWaId) {
      return {
        sent: false,
        blocked: true,
        reason: "INVALID_CUSTOMER_IDENTITY",
      };
    }

    const phoneNumberId =
      conversation.metadata?.phoneNumberId || this.apiService?.phoneNumberId;
    const lastUserMessageAt = conversation.lastUserMessageAt;

    if (!lastUserMessageAt) {
      return {
        sent: false,
        blocked: true,
        reason: "CUSTOMER_SERVICE_WINDOW_EXPIRED",
      };
    }

    const lastInboundMessageId = conversation.lastInboundMessageId;
    if (!lastInboundMessageId) {
      return {
        sent: false,
        blocked: true,
        reason: "INVALID_INBOUND_MESSAGE",
      };
    }

    const inboundTriggerContext = {
      triggeredByInboundMessage: true,
      inboundMessageId: lastInboundMessageId,
      customerWaId,
      phoneNumberId,
      inboundReceivedAt: lastUserMessageAt,
      authenticated: true,
      senderType: "agent",
      agentId,
      provider: this.provider?.name || "whapi",
    };

    return this.sendTextMessage(customerWaId, message.trim(), {
      inboundTriggerContext,
      conversationKey: sessionId,
      sessionId,
      lastUserMessageAt,
      senderType: "agent",
      now,
    });
  }

  // =====================================================
  // STATUS EVENTS
  // =====================================================

  async processStatuses(statuses = []) {
    for (const status of statuses) {
      console.log("[WhatsApp Status]", {
        id: status?.id,
        status: status?.status,
        recipientId: status?.recipient_id,
        timestamp: status?.timestamp,
      });

      const wamid = status?.id;
      const statusType = status?.status;

      if (wamid && statusType) {
        try {
          await this.conversationRepository.updateMessageStatus(
            wamid,
            statusType,
          );
        } catch (err) {
          // Non-fatal if DB is offline
        }

        let eventName = WhatsAppEvents.MESSAGE_DELIVERED;
        if (statusType === "read") eventName = WhatsAppEvents.MESSAGE_READ;
        else if (statusType === "failed")
          eventName = WhatsAppEvents.MESSAGE_FAILED;
        else if (statusType === "sent") eventName = WhatsAppEvents.MESSAGE_SENT;

        this.realtimeService.emitEvent(eventName, {
          wamid,
          status: statusType,
          recipientId: status?.recipient_id,
          timestamp: status?.timestamp,
        });
      }
    }
  }

  // =====================================================
  // ACTION SECURITY VALIDATION & RESOLUTION
  // =====================================================

  validateActionAgainstCurrentState(
    action,
    availableActions = [],
    conv = null,
  ) {
    if (!action) return { valid: false, reason: "NO_ACTION" };

    let targetAction = action;
    if (typeof action === "string") {
      const decoded = WhatsappActionCodec.decode(action);
      targetAction = decoded || { id: action, type: action, payload: {} };
    } else if (action && typeof action === "object") {
      const rawId = action.id || action.type || action.value;
      if (
        typeof rawId === "string" &&
        (rawId.includes(":") ||
          rawId.startsWith("Buttons") ||
          rawId.startsWith("quick_reply") ||
          rawId.startsWith("whapi") ||
          rawId.startsWith("meta"))
      ) {
        const decoded = WhatsappActionCodec.decode(rawId);
        if (decoded) {
          targetAction = {
            ...action,
            id: decoded.id,
            type: decoded.type,
            payload: {
              ...(action.payload || {}),
              ...(decoded.payload || {}),
            },
          };
        }
      }
    }

    const targetId = targetAction.id || targetAction.type;
    const targetPayload = targetAction.payload || {};

    if (!availableActions || availableActions.length === 0) {
      if (targetId && typeof targetId === "string") {
        return { valid: true, reason: null, matchedAction: targetAction };
      }
      return { valid: false, reason: "MALFORMED_ACTION" };
    }

    for (const avail of availableActions) {
      const availId = avail.id || avail.type;
      const availPayload = avail.payload || {};

      if (targetId === availId) {
        if (targetId === "SELECT_SELECTION") {
          const matchProduct =
            !targetPayload.productId ||
            !availPayload.productId ||
            String(targetPayload.productId).toLowerCase() ===
            String(availPayload.productId).toLowerCase();
          const matchSelection =
            !targetPayload.selectionId ||
            !availPayload.selectionId ||
            String(targetPayload.selectionId).toLowerCase() ===
            String(availPayload.selectionId).toLowerCase();
          if (matchProduct && matchSelection)
            return { valid: true, matchedAction: avail };
        } else if (targetId === "SELECT_NESTED_PRODUCT") {
          const matchProduct =
            !targetPayload.productId ||
            !availPayload.productId ||
            String(targetPayload.productId).toLowerCase() ===
            String(availPayload.productId).toLowerCase();
          const matchSelection =
            !targetPayload.selectionId ||
            !availPayload.selectionId ||
            String(targetPayload.selectionId).toLowerCase() ===
            String(availPayload.selectionId).toLowerCase();
          const matchNested =
            !targetPayload.nestedProductId ||
            !availPayload.nestedProductId ||
            String(targetPayload.nestedProductId).toLowerCase() ===
            String(availPayload.nestedProductId).toLowerCase();
          if (matchProduct && matchSelection && matchNested)
            return { valid: true, matchedAction: avail };
        } else if (targetId === "SELECT_PRODUCT") {
          const matchProduct =
            !targetPayload.productId ||
            !availPayload.productId ||
            String(targetPayload.productId).toLowerCase() ===
            String(availPayload.productId).toLowerCase();
          if (matchProduct) return { valid: true, matchedAction: avail };
        } else if (
          targetId === "SET_FORM_FIELD" ||
          targetId === "FORM_FIELD_VALUE"
        ) {
          const matchField =
            !targetPayload.fieldId ||
            !availPayload.fieldId ||
            String(targetPayload.fieldId).toLowerCase() ===
            String(availPayload.fieldId).toLowerCase();
          const matchValue =
            targetPayload.value == null ||
            availPayload.value == null ||
            String(targetPayload.value).toLowerCase() ===
            String(availPayload.value).toLowerCase();
          if (matchField && matchValue)
            return { valid: true, matchedAction: avail };
        } else if (targetId === "SUBMIT_ORDER_FORM") {
          const matchForm =
            !targetPayload.formId ||
            !availPayload.formId ||
            String(targetPayload.formId).toLowerCase() ===
            String(availPayload.formId).toLowerCase();
          if (matchForm) return { valid: true, matchedAction: avail };
        } else {
          return { valid: true, matchedAction: avail };
        }
      }
    }

    return { valid: false, reason: "FORGED_OR_STALE_ACTION" };
  }

  extractAvailableActions(conv = null, sessionId = null, customerWaId = null) {
    if (sessionId && this.lastAvailableActions.has(sessionId)) {
      return this.lastAvailableActions.get(sessionId);
    }
    if (customerWaId && this.lastAvailableActions.has(customerWaId)) {
      return this.lastAvailableActions.get(customerWaId);
    }
    if (!conv) return [];

    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.role === "assistant" ||
        msg.senderType === "assistant" ||
        msg.senderType === "ai"
      ) {
        if (msg.interactiveData) {
          const interactive = msg.interactiveData;
          if (Array.isArray(interactive.action?.buttons)) {
            const btns = interactive.action.buttons
              .map((b) => {
                const id = b.reply?.id || b.id;
                const title = b.reply?.title || b.title || b.label;
                const decoded = WhatsappActionCodec.decode(id);
                return decoded
                  ? {
                    id: decoded.id || decoded.type,
                    type: decoded.type || decoded.id,
                    label: title,
                    payload: decoded.payload || {},
                  }
                  : null;
              })
              .filter(Boolean);
            if (btns.length) return btns;
          }
          if (Array.isArray(interactive.action?.sections)) {
            const rows = interactive.action.sections.flatMap(
              (s) => s.rows || [],
            );
            const listActions = rows
              .map((r) => {
                const decoded = WhatsappActionCodec.decode(r.id);
                return decoded
                  ? {
                    id: decoded.id || decoded.type,
                    type: decoded.type || decoded.id,
                    label: r.title || r.label,
                    description: r.description,
                    payload: decoded.payload || {},
                  }
                  : null;
              })
              .filter(Boolean);
            if (listActions.length) return listActions;
          }
        }
        break;
      }
    }

    if (
      conv.workflow === "SALES" ||
      conv.memory?.liveRequirement ||
      conv.memory?.productSales
    ) {
      try {
        const req =
          conv.memory?.liveRequirement || conv.memory?.productSales || {};
        if (req?.items?.length) {
          const decisionService = new ConversationDecisionService();
          const decision = decisionService.decide(req);
          if (Array.isArray(decision?.actions) && decision.actions.length > 0) {
            return decision.actions.map((a) => ({
              id: a.id || a.type,
              type: a.type || a.id,
              label: a.label || a.title || a.name,
              payload: a.payload || {},
            }));
          }
        }
      } catch (err) {
        // Non-fatal
      }
    }

    return [];
  }

  resolveTextAction(userText = "", availableActions = []) {
    if (
      !userText ||
      typeof userText !== "string" ||
      !Array.isArray(availableActions) ||
      availableActions.length === 0
    ) {
      return null;
    }

    const raw = userText.trim();
    if (!raw) return null;

    // 1. Numeric index matching ("1", "2", etc.)
    const numMatch = raw.match(/^\s*([0-9]{1,2})\s*$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < availableActions.length) {
        return availableActions[idx];
      }
    }

    // Word numbers & "option 1"
    const wordNumbers = {
      one: 0,
      first: 0,
      two: 1,
      second: 1,
      three: 2,
      third: 2,
      four: 3,
      fourth: 3,
      five: 4,
      fifth: 4,
    };
    const lowerRaw = raw.toLowerCase();
    const optMatch = lowerRaw.match(
      /^(?:option|choice|item|selection)\s*([0-9]{1,2})$/,
    );
    if (optMatch) {
      const idx = parseInt(optMatch[1], 10) - 1;
      if (idx >= 0 && idx < availableActions.length) {
        return availableActions[idx];
      }
    }
    if (
      wordNumbers[lowerRaw] !== undefined &&
      wordNumbers[lowerRaw] < availableActions.length
    ) {
      return availableActions[wordNumbers[lowerRaw]];
    }

    // 2. Text / Label exact & token containment matching
    const cleanUserText = lowerRaw
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleanUserText) return null;

    for (const action of availableActions) {
      const actionLabel = String(
        action.label || action.title || action.name || "",
      )
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const selectionId = String(
        action.payload?.selectionId || action.payload?.productId || "",
      )
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (cleanUserText === actionLabel || cleanUserText === selectionId) {
        return action;
      }
    }

    const matches = [];
    for (const action of availableActions) {
      const actionLabel = String(
        action.label || action.title || action.name || "",
      )
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const selectionId = String(
        action.payload?.selectionId || action.payload?.productId || "",
      )
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const userTokens = cleanUserText.split(" ").filter((t) => t.length > 1);
      const labelTokens = actionLabel.split(" ").filter((t) => t.length > 1);
      const selectionTokens = selectionId
        .split(" ")
        .filter((t) => t.length > 1);

      if (
        actionLabel.includes(cleanUserText) ||
        (selectionId && selectionId.includes(cleanUserText))
      ) {
        matches.push({
          action,
          score: cleanUserText.length / Math.max(actionLabel.length, 1),
        });
        continue;
      }

      const matchedTokens = userTokens.filter(
        (t) => labelTokens.includes(t) || selectionTokens.includes(t),
      );
      if (
        matchedTokens.length > 0 &&
        matchedTokens.length === userTokens.length
      ) {
        matches.push({
          action,
          score: matchedTokens.length / Math.max(labelTokens.length, 1),
        });
      }
    }

    if (matches.length === 1) return matches[0].action;
    if (matches.length > 1) {
      matches.sort((a, b) => b.score - a.score);
      if (matches[0].score > matches[1].score) return matches[0].action;
    }

    return null;
  }

  isSenderAllowed(phoneNumber) {
    return this.allowlistPolicy.isAuthorized(phoneNumber);
  }
}
