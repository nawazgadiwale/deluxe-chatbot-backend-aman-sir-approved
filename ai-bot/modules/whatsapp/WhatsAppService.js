/**
 * WhatsAppService.js
 *
 * Canonical WhatsApp Gateway Orchestration Layer for ExprintMart AI Backend.
 * Thin provider-neutral transport orchestration:
 * 1. Webhook receiving & verification
 * 2. Provider normalization (Meta WhatsApp Cloud API)
 * 3. Authoritative inbound single-sender allowlist gate
 * 4. Deduplication & session-level concurrency serialization
 * 5. AI conversation graph dispatch
 * 6. Customer service window & outbound policy enforcement
 * 7. Outbound response delivery & async 131053 media fallback
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
    allowlistPolicy = null,
  ) {
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    this.provider = provider || WhatsAppProviderFactory.getProvider();
    this.apiService =
      apiService || new WhatsAppApiService({ provider: this.provider });
    this.windowPolicy =
      windowPolicy || new WhatsAppCustomerServiceWindowPolicy();
    this.allowlistPolicy = allowlistPolicy || new WhatsAppAllowlistPolicy();
    this.sessionService = new WhatsAppSessionService(this.allowlistPolicy);
    this.outboundPolicy =
      outboundPolicy ||
      new WhatsAppOutboundPolicy({
        windowPolicy: this.windowPolicy,
        allowlistPolicy: this.allowlistPolicy,
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
    this.flowSubmissionService = new WhatsAppFlowSubmissionService({
      conversationRepository: this.conversationRepository,
      allowlistPolicy: this.allowlistPolicy,
    });

    this.processedMessageIds = new Set();
    this.maxProcessedMessageIds = 5000;
    this.lastAvailableActions = new Map();
    this.maxTrackedSessions = 5000;
    this.sessionQueues = new Map();

    // In-memory correlation map for outbound media messages to handle async 131053 failures
    this.outboundMediaFallbacks = new Map();
    this.maxTrackedFallbacks = 2000;
  }

  // =====================================================
  // SESSION CONCURRENCY & DEDUPLICATION
  // =====================================================

  enqueueSessionTask(sessionId, fn) {
    if (!sessionId || typeof fn !== "function") {
      return typeof fn === "function" ? fn() : Promise.resolve();
    }
    const prev = this.sessionQueues.get(sessionId) || Promise.resolve();
    const next = prev
      .catch((err) => {
        console.error(
          `[WhatsAppService] Queued session task error for ${sessionId}:`,
          err?.message,
        );
      })
      .then(() => fn())
      .finally(() => {
        if (this.sessionQueues.get(sessionId) === next) {
          this.sessionQueues.delete(sessionId);
        }
      });
    this.sessionQueues.set(sessionId, next);
    return next;
  }

  setAvailableActions(key, actions) {
    if (!key) return;
    if (this.lastAvailableActions.size >= this.maxTrackedSessions) {
      const oldest = this.lastAvailableActions.keys().next().value;
      if (oldest) this.lastAvailableActions.delete(oldest);
    }
    this.lastAvailableActions.set(key, actions);
  }

  isDuplicateMessage(messageId) {
    return Boolean(
      messageId && this.processedMessageIds.has(String(messageId)),
    );
  }

  markMessageProcessed(messageId) {
    if (!messageId) return;
    if (this.processedMessageIds.size >= this.maxProcessedMessageIds) {
      const oldest = this.processedMessageIds.values().next().value;
      if (oldest) this.processedMessageIds.delete(oldest);
    }
    this.processedMessageIds.add(String(messageId));
  }

  isSenderAllowed(phoneNumber) {
    return this.allowlistPolicy.isAuthorized(phoneNumber);
  }

  // =====================================================
  // WEBHOOK VERIFICATION (GET)
  // =====================================================

  verifyWebhook(mode, token, challenge) {
    if (mode !== "subscribe") return false;
    const verifyToken = this.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken || !token || !challenge || token !== verifyToken) {
      if (token && token !== verifyToken) {
        console.error("[WhatsApp] Webhook verification token mismatch.");
      }
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

      const expBuf = Buffer.from(expectedHex, "utf8");
      const recBuf = Buffer.from(cleanSignature, "utf8");

      return (
        expBuf.length === recBuf.length &&
        crypto.timingSafeEqual(expBuf, recBuf)
      );
    } catch {
      return false;
    }
  }

  // =====================================================
  // CANONICAL INBOUND WEBHOOK PIPELINE (POST)
  // =====================================================

  async handleWebhook(body = {}, authContext = {}) {
    if (!body || typeof body !== "object") return;

    const correlationId =
      authContext?.correlationId || `req_${Date.now().toString(36)}`;
    const providerName =
      authContext?.provider ||
      (body.object === "whatsapp_business_account"
        ? "meta"
        : process.env.WHATSAPP_PROVIDER || this.provider?.name || "meta");

    let activeProvider = this.provider;
    if (providerName && this.provider?.name !== providerName) {
      try {
        activeProvider = WhatsAppProviderFactory.getProvider(providerName);
      } catch {
        activeProvider = this.provider;
      }
    }

    console.log(`[WhatsApp] Provider: ${activeProvider.name}`);
    console.log("[WhatsApp] Webhook received");
    console.log(
      `[WhatsApp][Service] correlationId=${correlationId} handleWebhook start provider=${activeProvider.name} payloadKeys=${Object.keys(body).join(",")}`,
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

    // Fallback for raw Meta webhook structure if provider returned empty
    if (body.object === "whatsapp_business_account") {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      for (const entry of entries) await this.processEntry(entry);
    }
  }

  async processNormalizedEvent(event = {}, authContext = {}) {
    if (!event) return;

    const customerWaId = event.customerWaId;
    if (!this.allowlistPolicy.isAuthorized(customerWaId)) {
      console.log(
        `[WhatsApp] Unauthorized sender ignored (${this.allowlistPolicy.maskPhone(customerWaId)})`,
      );
      if (event.messageId) this.markMessageProcessed(event.messageId);
      return;
    }

    const sessionDigits =
      this.allowlistPolicy.normalizeToSessionDigits(customerWaId) ||
      customerWaId;
    return this.enqueueSessionTask(`whatsapp:${sessionDigits}`, () =>
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
    const correlationId = authContext?.correlationId || crypto.randomUUID();
    const provider =
      event.provider ||
      process.env.WHATSAPP_PROVIDER ||
      this.provider?.name ||
      "meta";

    const normalizedSender =
      this.allowlistPolicy.normalizeToE164(customerWaId) || customerWaId;
    console.log(`[WhatsApp] Inbound sender: ${normalizedSender}`);
    console.log(
      `[WhatsApp][Inbound] correlationId=${correlationId} received messageId=${messageId} sender=${this.allowlistPolicy.maskPhone(customerWaId)} provider=${provider}`,
    );

    // 1. Deduplication check
    const isDuplicate = this.isDuplicateMessage(messageId);
    console.log(
      `[WhatsApp][Duplicate] correlationId=${correlationId} messageId=${messageId} duplicate=${isDuplicate}`,
    );

    if (messageId && isDuplicate) {
      console.log("[WhatsApp] DUPLICATE_EVENT_IGNORED:", {
        correlationId,
        messageId,
      });
      return;
    }
    if (!messageId) {
      console.warn("[WhatsApp] Inbound event missing messageId. Dropping.");
      return;
    }

    console.log("[WhatsApp] Allowlist: MATCH");
    this.markMessageProcessed(messageId);

    const receivedAt = Date.now();
    const customerTimestamp = event.timestamp || receivedAt;
    const phoneNumberId = event.phoneNumberId || this.apiService?.phoneNumberId;

    // 2. Customer service window & session identity
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

    // 3. Persist inbound message to MongoDB
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
    } catch {
      // Non-fatal if DB offline
    }

    // 4. CRM Realtime event emissions
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

    // 5. Media attachments resolution
    let resolvedAttachments = event.attachments || [];
    if (resolvedAttachments.length > 0) {
      resolvedAttachments =
        await this.mediaService.resolveAttachments(resolvedAttachments);
    }

    // 6. Fast-Path: Deterministic Flow Submission Handler
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

      if (flowResult?.response) {
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
      } else if (flowResult?.userMessage) {
        await this.sendMessage(
          customerWaId,
          { type: "text", text: { body: flowResult.userMessage } },
          { inboundTriggerContext, conversationKey: customerWaId, sessionId },
        );
        return;
      }
    }

    // 7. Action extraction, decoding, and validation
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
    } else if (event.text && typeof event.text === "string" && availableActions.length > 0) {
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

    // 8. AI Conversation Dispatch
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
  // COMPATIBILITY RAW ENTRY / MESSAGE DISPATCH
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
    if (!this.allowlistPolicy.isAuthorized(customerWaId)) {
      console.log(
        `[WhatsApp] Unauthorized sender ignored (${this.allowlistPolicy.maskPhone(customerWaId)})`,
      );
      if (message.id) this.markMessageProcessed(message.id);
      return;
    }

    return this.processNormalizedEvent(
      {
        provider:
          message?.provider ||
          process.env.WHATSAPP_PROVIDER ||
          this.provider?.name ||
          "meta",
        eventType: incoming.eventType || "MESSAGE",
        messageType: message.type || "text",
        messageId: message.id || incoming.whatsapp.messageId,
        customerWaId,
        phoneNumberId:
          metadata?.phone_number_id || this.apiService?.phoneNumberId,
        timestamp: message.timestamp
          ? Number(message.timestamp) * 1000
          : Date.now(),
        text: incoming.message || null,
        action: incoming.action || null,
        attachments: incoming.attachments || [],
        fromName: incoming.visitor?.name || null,
        rawProviderEvent: message,
        isFlowSubmission: incoming.isFlowSubmission === true,
        flow: incoming.flow || null,
      },
      authContext,
    );
  }

  async processEntry(entry = {}) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      await this.processChange(change);
    }
  }

  async processChange(change = {}) {
    if (change?.field !== "messages") return;
    const value = change?.value || {};
    if (Array.isArray(value.statuses)) await this.processStatuses(value.statuses);
    for (const message of Array.isArray(value.messages) ? value.messages : []) {
      try {
        await this.processMessage({
          message,
          metadata: value.metadata || {},
          contacts: value.contacts || [],
        });
      } catch (err) {
        console.error("[WhatsApp] Message processing error:", err.message);
      }
    }
  }

  // =====================================================
  // OUTBOUND DISPATCH & RESULT DELIVERY
  // =====================================================

  _resetCancelledResult(result) {
    const cleanMeta = (meta = {}) => ({
      ...meta,
      stage: "CANCELLED",
      cancelled: true,
      product: null,
      selectedProduct: null,
      selection: null,
      image: null,
      images: [],
      attachments: [],
    });

    return {
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
      metadata: cleanMeta(result?.metadata),
      response: {
        ...(result?.response ?? {}),
        workflow: "NONE",
        currentStep: null,
        nextStep: null,
        action: null,
        actions: [],
        liveRequirement: null,
        metadata: cleanMeta(result?.response?.metadata),
      },
    };
  }

  async sendResult(incoming, result, timing = {}) {
    const inboundTriggerContext =
      timing.inboundTriggerContext || incoming?.inboundTriggerContext;
    const conversationKey =
      incoming?.whatsapp?.phoneNumber || incoming?.sessionId;
    const targetSessionId =
      incoming?.sessionId || `whatsapp:${incoming?.whatsapp?.phoneNumber}`;

    const isCancelled =
      result?.metadata?.cancelled === true ||
      result?.response?.metadata?.cancelled === true ||
      result?.metadata?.stage === "CANCELLED" ||
      result?.response?.metadata?.stage === "CANCELLED" ||
      result?.action?.id === "CANCEL_ORDER" ||
      result?.response?.action?.id === "CANCEL_ORDER";

    if (isCancelled) {
      console.log(`[CANCEL][OUTBOUND][RESET] session=${targetSessionId}`);
      this.lastAvailableActions.delete(targetSessionId);
      if (incoming?.whatsapp?.phoneNumber) {
        this.lastAvailableActions.delete(incoming.whatsapp.phoneNumber);
      }
      result = this._resetCancelledResult(result);
      console.log("[CANCEL][OUTBOUND][MEDIA_BLOCKED]");
    } else {
      const actions = this.responseAdapter.extractActions(result);
      if (actions?.length > 0) {
        this.setAvailableActions(targetSessionId, actions);
        if (incoming?.whatsapp?.phoneNumber) {
          this.setAvailableActions(incoming.whatsapp.phoneNumber, actions);
        }
      }
    }

    const outboundWorkflow =
      result?.workflow ??
      result?.response?.workflow ??
      incoming?.workflow ??
      null;

    const outgoingMessages = this.responseAdapter.toWhatsAppMessages({
      ...result,
      workflow: outboundWorkflow,
      sessionId: result?.sessionId ?? incoming?.sessionId ?? null,
      visitorId: result?.visitorId ?? incoming?.visitorId ?? null,
      whatsapp: result?.whatsapp ?? incoming?.whatsapp ?? null,
      liveRequirement: result?.liveRequirement ?? null,
    });

    if (isCancelled) {
      console.log(`[CANCEL][OUTBOUND] messages=${outgoingMessages.length}`);
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
        console.error("[WhatsApp] Outbound message send failure:", {
          to: incoming.whatsapp?.phoneNumber,
          type: outgoing?.type,
          error: err.message,
        });
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

    const recordedTimestamp =
      this.windowPolicy.getLastUserMessageAt(conversationKey);
    const inboundTimestamp = inboundTriggerContext.inboundReceivedAt;
    const lastUserMessageAt =
      options.lastUserMessageAt !== undefined
        ? options.lastUserMessageAt
        : inboundTimestamp && (!recordedTimestamp || inboundTimestamp > recordedTimestamp)
          ? inboundTimestamp
          : recordedTimestamp || inboundTimestamp;

    const authorization = this.outboundPolicy.authorizeOutbound({
      to,
      message,
      inboundTriggerContext,
      lastUserMessageAt,
      now,
      credentials: {
        accessToken: this.apiService?.accessToken,
        phoneNumberId: this.apiService?.phoneNumberId,
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

    const normalizedRecipient =
      this.allowlistPolicy.normalizeToE164(to) || to;
    console.log(`[WhatsApp] Replying to: ${normalizedRecipient}`);
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

    // Correlate outbound media message for async 131053 error handling
    if (metaWamid && !options.isFallback) {
      const hasMediaHeader =
        message?.type === "interactive" &&
        message?.interactive?.header?.type === "image";
      const isDirectImage = message?.type === "image";

      if (hasMediaHeader || isDirectImage) {
        let fallbackMessage = null;
        if (hasMediaHeader) {
          const { header, ...interactiveWithoutHeader } = message.interactive;
          fallbackMessage = {
            ...message,
            interactive: interactiveWithoutHeader,
          };
        } else {
          const caption = message.image?.caption || message.caption || "";
          fallbackMessage = {
            type: "text",
            text: {
              preview_url: false,
              body: caption || "Here are the details for your request.",
            },
          };
        }

        if (this.outboundMediaFallbacks.size >= this.maxTrackedFallbacks) {
          const oldest = this.outboundMediaFallbacks.keys().next().value;
          if (oldest) this.outboundMediaFallbacks.delete(oldest);
        }
        this.outboundMediaFallbacks.set(metaWamid, {
          to,
          fallbackMessage,
          options: { ...options, isFallback: true },
          fallenBack: false,
          createdAt: Date.now(),
        });
      }
    }

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
    } catch {
      // Non-fatal if DB offline
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
  // CONVENIENCE OUTBOUND APIS
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
    return this.sendMessage(
      to,
      {
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
      },
      options,
    );
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
    return this.sendMessage(
      to,
      {
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
      },
      options,
    );
  }

  async sendFlowMessage(
    to,
    bodyText,
    flowParams = {},
    header = null,
    footer = null,
    options = {},
  ) {
    return this.sendMessage(
      to,
      {
        type: "interactive",
        interactive: {
          type: "flow",
          body: { text: bodyText },
          action: { name: "flow", parameters: flowParams },
          ...(header ? { header } : {}),
          ...(footer ? { footer: { text: footer } } : {}),
        },
      },
      options,
    );
  }

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
      return { sent: false, blocked: true, reason: "CONVERSATION_NOT_FOUND" };
    }
    if (conversation.channel !== "WHATSAPP") {
      return { sent: false, blocked: true, reason: "INVALID_CHANNEL" };
    }

    const customerWaId = conversation.customerWaId;
    if (!customerWaId || !this.allowlistPolicy.isAuthorized(customerWaId)) {
      return { sent: false, blocked: true, reason: "UNAUTHORIZED_RECIPIENT" };
    }

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
      phoneNumberId:
        conversation.metadata?.phoneNumberId || this.apiService?.phoneNumberId,
      inboundReceivedAt: lastUserMessageAt,
      authenticated: true,
      senderType: "agent",
      agentId,
      provider: this.provider?.name || process.env.WHATSAPP_PROVIDER || "meta",
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
  // ASYNC STATUS EVENTS & 131053 MEDIA FALLBACK
  // =====================================================

  async processStatuses(statuses = []) {
    for (const status of statuses) {
      const errors = status?.errors || [];
      const isFailed = status?.status === "failed";
      const isMedia131053 =
        isFailed &&
        errors.some(
          (e) =>
            e.code === 131053 ||
            String(e.title || "").toLowerCase().includes("media upload error") ||
            String(e.message || "").toLowerCase().includes("media upload error"),
        );

      if (isMedia131053) {
        console.log("[Meta Media] Media delivery failed: 131053");
        const wamid = status?.id;
        const fallbackItem = wamid
          ? this.outboundMediaFallbacks.get(wamid)
          : null;

        if (fallbackItem) {
          if (fallbackItem.fallenBack) {
            console.log("[Meta Media] Fallback already sent, skipping");
          } else {
            fallbackItem.fallenBack = true;
            console.log("[Meta Media] Sending media-free fallback");
            try {
              await this.sendMessage(
                fallbackItem.to,
                fallbackItem.fallbackMessage,
                fallbackItem.options,
              );
            } catch (fallbackErr) {
              console.error(
                "[Meta Media] Failed to send media-free fallback:",
                fallbackErr.message,
              );
            }
          }
        }
      }

      console.log("[WhatsApp Status]", {
        id: status?.id,
        status: status?.status,
        recipientId: status?.recipient_id,
        timestamp: status?.timestamp,
        errors,
      });

      const wamid = status?.id;
      const statusType = status?.status;
      if (wamid && statusType) {
        try {
          await this.conversationRepository.updateMessageStatus(
            wamid,
            statusType,
          );
        } catch {
          // Non-fatal
        }

        let eventName = WhatsAppEvents.MESSAGE_DELIVERED;
        if (statusType === "read") eventName = WhatsAppEvents.MESSAGE_READ;
        else if (statusType === "failed") eventName = WhatsAppEvents.MESSAGE_FAILED;
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
  // ACTION VALIDATION & RESOLUTION
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
    const tp = targetAction.payload || {};

    if (!availableActions || availableActions.length === 0) {
      return targetId && typeof targetId === "string"
        ? { valid: true, reason: null, matchedAction: targetAction }
        : { valid: false, reason: "MALFORMED_ACTION" };
    }

    const eq = (a, b) =>
      !a || !b || String(a).toLowerCase() === String(b).toLowerCase();

    for (const avail of availableActions) {
      const availId = avail.id || avail.type;
      if (targetId !== availId) continue;
      const ap = avail.payload || {};

      if (
        targetId === "SELECT_SELECTION" &&
        (!eq(tp.productId, ap.productId) || !eq(tp.selectionId, ap.selectionId))
      ) {
        continue;
      }
      if (
        targetId === "SELECT_NESTED_PRODUCT" &&
        (!eq(tp.productId, ap.productId) ||
          !eq(tp.selectionId, ap.selectionId) ||
          !eq(tp.nestedProductId, ap.nestedProductId))
      ) {
        continue;
      }
      if (targetId === "SELECT_PRODUCT" && !eq(tp.productId, ap.productId)) {
        continue;
      }
      if (
        (targetId === "SET_FORM_FIELD" || targetId === "FORM_FIELD_VALUE") &&
        (!eq(tp.fieldId, ap.fieldId) || !eq(tp.value, ap.value))
      ) {
        continue;
      }
      if (targetId === "SUBMIT_ORDER_FORM" && !eq(tp.formId, ap.formId)) {
        continue;
      }
      return { valid: true, matchedAction: avail };
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
      } catch {
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

    const normalizeStr = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    for (const action of availableActions) {
      const actionLabel = normalizeStr(
        action.label || action.title || action.name,
      );
      const selectionId = normalizeStr(
        action.payload?.selectionId || action.payload?.productId,
      );
      if (cleanUserText === actionLabel || cleanUserText === selectionId) {
        return action;
      }
    }

    const matches = [];
    for (const action of availableActions) {
      const actionLabel = normalizeStr(
        action.label || action.title || action.name,
      );
      const selectionId = normalizeStr(
        action.payload?.selectionId || action.payload?.productId,
      );

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
      if (matchedTokens.length > 0 && matchedTokens.length === userTokens.length) {
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
}
