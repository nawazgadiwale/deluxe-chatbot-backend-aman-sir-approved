import WhatsAppService from "./WhatsAppService.js";
import WhatsAppProviderFactory from "./providers/WhatsAppProviderFactory.js";

export default class WhatsAppWebhookHandler {
  constructor(service = null, provider = null) {
    this.service = service || new WhatsAppService();
    this.provider = provider || null;
    this.metaAdapter = provider || null;
  }

  getProvider() {
    const adapter = this.provider || this.metaAdapter;
    if (adapter) {
      if (this.service?.appSecret !== undefined) {
        adapter.appSecret = this.service.appSecret;
      }
      if (this.service?.verifyToken !== undefined) {
        adapter.verifyToken = this.service.verifyToken;
      }
      return adapter;
    }

    return WhatsAppProviderFactory.getProvider("meta", {
      appSecret: this.service?.appSecret,
      verifyToken: this.service?.verifyToken,
    });
  }

  verify(req, res = null) {
    try {
      console.log("[WhatsApp][Meta] GET webhook verification");

      const result = this.getProvider().verifyWebhook(req);

      if (!result.verified) {
        if (res && typeof res.status === "function") {
          return res
            .status(result.status || 403)
            .send(result.body || "Forbidden");
        }

        return {
          status: result.status || 403,
          body: result.body || "Forbidden",
        };
      }

      if (res && typeof res.status === "function") {
        return res
          .status(result.status || 200)
          .send(result.challenge || result.body);
      }

      return {
        status: result.status || 200,
        body: result.challenge || result.body,
      };
    } catch (error) {
      console.error(
        "[WhatsApp][Meta] Verification error:",
        error.message,
      );

      if (res && typeof res.status === "function") {
        return res.status(500).send("Internal error");
      }

      return {
        status: 500,
        error: error.message,
      };
    }
  }

  async handle(req, res = null) {
    try {
      const correlationId =
        req.headers?.["x-correlation-id"] ||
        req.headers?.["x-request-id"] ||
        `req_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;

      console.log(
        `[WhatsApp][Meta] POST received correlationId=${correlationId}`,
      );

      if (!req.body || typeof req.body !== "object") {
        if (res && typeof res.status === "function") {
          return res.status(400).send("Invalid webhook payload");
        }

        return {
          status: 400,
          body: "Invalid webhook payload",
        };
      }

      const auth = this.getProvider().authenticateWebhook(req);

      if (!auth.authenticated) {
        console.warn(
          `[WhatsApp][Meta] Authentication failed correlationId=${correlationId}: ${auth.error}`,
        );

        if (res && typeof res.status === "function") {
          return res
            .status(auth.status || 403)
            .send(auth.error || "Authentication failed");
        }

        return {
          status: auth.status || 403,
          body: auth.error || "Authentication failed",
        };
      }

      console.log(
        `[WhatsApp][Meta] Authenticated correlationId=${correlationId}`,
      );

      if (res && typeof res.status === "function") {
        res.status(200).send("EVENT_RECEIVED");
      }

      setImmediate(async () => {
        try {
          await this.service.handleWebhook(req.body, {
            authenticated: true,
            provider: "meta",
            headers: req.headers,
            correlationId,
          });

          console.log(
            `[WhatsApp][Meta] Processing completed correlationId=${correlationId}`,
          );
        } catch (error) {
          console.error(
            `[WhatsApp][Meta] Processing failed correlationId=${correlationId}:`,
            error.message,
            error.stack,
          );
        }
      });

      return {
        status: 200,
        body: "EVENT_RECEIVED",
      };
    } catch (error) {
      console.error(
        "[WhatsApp][Meta] Webhook error:",
        error.message,
        error.stack,
      );

      if (res && !res.headersSent && typeof res.status === "function") {
        return res.status(500).send("Internal server error");
      }

      return {
        status: 500,
        error: error.message,
      };
    }
  }
}