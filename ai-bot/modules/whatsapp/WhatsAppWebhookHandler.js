import WhatsAppService from "./WhatsAppService.js";
import MetaProviderAdapter from "./providers/MetaProviderAdapter.js";

export default class WhatsAppWebhookHandler {
  constructor(service = null, metaAdapter = null) {
    this.service = service || new WhatsAppService();
    this.metaAdapter =
      metaAdapter ||
      new MetaProviderAdapter({
        appSecret: this.service?.appSecret,
        verifyToken: this.service?.verifyToken,
      });
  }

  getProvider(req = null) {
    return this.metaAdapter;
  }

  // =====================================================
  // GET /webhooks/whatsapp (Verification Challenge)
  // =====================================================

  verify(req, res) {
    try {
      const result = this.metaAdapter.verifyWebhook(req);

      if (!result.verified) {
        if (res && typeof res.status === "function") {
          return res.status(result.status || 403).send(result.body || "Forbidden");
        }
        return { status: result.status || 403, body: result.body || "Forbidden" };
      }

      if (res && typeof res.status === "function") {
        return res.status(result.status || 200).send(result.challenge || result.body);
      }

      return { status: result.status || 200, body: result.challenge || result.body };
    } catch (error) {
      if (res && typeof res.status === "function") {
        return res.status(500).send("Internal error");
      }
      return { status: 500, error: error.message };
    }
  }

  async parseRequestBody(req) {
    if (!req) return {};

    if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
      return req.body;
    }

    if (typeof req.body === "string" && req.body.trim().length > 0) {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return { rawText: req.body };
      }
    }

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      try {
        return JSON.parse(req.body.toString("utf8"));
      } catch (e) {
        return { rawText: req.body.toString("utf8") };
      }
    }

    if (req.rawBody) {
      const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody);
      if (raw.trim().length > 0) {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return { rawText: raw };
        }
      }
    }

    // If req is a readable stream and has not ended
    if (typeof req.on === "function" && !req.readableEnded && !req.complete) {
      try {
        const bodyBuffer = await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          req.on("error", (err) => reject(err));
        });
        if (bodyBuffer && bodyBuffer.trim().length > 0) {
          try {
            return JSON.parse(bodyBuffer);
          } catch (e) {
            return { rawText: bodyBuffer };
          }
        }
      } catch (e) {
        // Stream read failed or already consumed
      }
    }

    return req.body || {};
  }

  // =====================================================
  // POST /webhooks/whatsapp (Event Handler)
  // =====================================================

  async handle(req, res) {
    try {
      const correlationId =
        req.headers?.["x-correlation-id"] ||
        req.headers?.["x-request-id"] ||
        `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      const method = req.method || "POST";
      const rawPath = req.originalUrl || req.url || req.path || "/webhooks/whatsapp";
      const path = rawPath.replace(/([?&](?:secret|token|key|verify_token)=)[^&]+/gi, "$1[REDACTED]");
      const contentType = req.headers?.["content-type"] || "none";
      const contentLength = req.headers?.["content-length"] || "0";
      const bodyType = typeof req.body;
      const isArray = Array.isArray(req.body);
      const rawBodyPresent = Boolean(req.rawBody || Buffer.isBuffer(req.body));
      const rawBodyLength = req.rawBody ? (req.rawBody.length || 0) : (Buffer.isBuffer(req.body) ? req.body.length : 0);

      const parsedBody = await this.parseRequestBody(req);
      req.body = parsedBody;

      const bodyKeys = Object.keys(parsedBody || {}).join(",");

      console.log(
        `[WhatsApp][Webhook] correlationId=${correlationId} method=${method} path=${path} contentType=${contentType} contentLength=${contentLength} bodyType=${bodyType} isArray=${isArray} bodyKeys=${bodyKeys} rawBodyPresent=${rawBodyPresent} rawBodyLength=${rawBodyLength}`,
      );

      // Meta HMAC SHA-256 Signature Verification
      const auth = this.metaAdapter.authenticateWebhook(req);

      if (!auth.authenticated) {
        const status = auth.status || 403;
        const errMsg = auth.error || "Authentication failed";
        console.warn(
          `[WhatsApp Webhook] correlationId=${correlationId} Authentication failed for Meta Cloud API. Status: ${status}, Error: ${errMsg}`,
        );

        if (res && typeof res.status === "function") {
          return res.status(status).send(errMsg);
        }
        return { status, body: errMsg };
      }

      console.log(`[WhatsApp][Auth] correlationId=${correlationId} authenticated provider=meta`);

      // Fast 200 OK acknowledgment to Meta after successful authentication
      if (res && typeof res.status === "function") {
        res.status(200).send("EVENT_RECEIVED");
      }

      console.log(`[WhatsApp][Async] correlationId=${correlationId} scheduling message processing bodyKeys=${bodyKeys}`);

      // Asynchronous background processing of verified inbound payload
      setImmediate(async () => {
        try {
          console.log(`[WhatsApp][Async] correlationId=${correlationId} starting message processing bodyKeys=${bodyKeys}`);
          await this.service.handleWebhook(parsedBody, {
            authenticated: true,
            provider: "meta",
            headers: req.headers,
            correlationId,
          });
          console.log(`[WhatsApp][Async] correlationId=${correlationId} message processing completed`);
        } catch (err) {
          console.error(
            `[WhatsApp][Async] correlationId=${correlationId} message processing failed (meta):`,
            err.message,
            err.stack,
          );
        }
      });

      return { status: 200, body: "EVENT_RECEIVED" };
    } catch (error) {
      console.error("[WhatsApp Webhook] Error:", error.message, error.stack);
      if (res && !res.headersSent && typeof res.status === "function") {
        return res.status(500).send("Internal server error");
      }
      return { status: 500, error: error.message };
    }
  }
}
