const DEFAULT_TIMEOUT_MS = 30000;

export default class SupportEngine {
  constructor() {
    this.webhookUrl = process.env.N8N_FAQ_WEBHOOK_URL;

    this.timeoutMs = Number(
      process.env.N8N_FAQ_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    );
  }

  async generate(state = {}) {
    if (!this.webhookUrl) {
      throw new Error("N8N_FAQ_WEBHOOK_URL is not configured.");
    }

    const question = state.userMessage?.trim() || state.message?.trim() || "";

    if (!question) {
      throw new Error("FAQ question is required.");
    }

    const payload = {
      type: "faq",
      sessionId: state.sessionId ?? null,
      visitorId: state.visitorId ?? null,
      site: state.site ?? "exprintmart",

      question,

      history: Array.isArray(state.history) ? state.history.slice(-10) : [],

      customer: state.customer ?? null,
      orderRequest: state.orderRequest ?? null,
      visitor: state.visitor ?? null,
    };

    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          ...(process.env.N8N_FAQ_WEBHOOK_SECRET
            ? {
                "x-faq-webhook-secret": process.env.N8N_FAQ_WEBHOOK_SECRET,
              }
            : {}),
        },

        body: JSON.stringify(payload),

        signal: controller.signal,
      });

      const raw = await response.text();

      let result;

      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("n8n returned invalid JSON.");
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `n8n returned HTTP ${response.status}`,
        );
      }

      if (result?.success === false) {
        throw new Error(result.message || "n8n FAQ workflow failed.");
      }

      return {
        context: result.context ?? "",

        documents: Array.isArray(result.documents) ? result.documents : [],

        response: {
          answer: result.answer ?? result.response?.answer ?? "",

          references: Array.isArray(result.references)
            ? result.references
            : (result.response?.references ?? []),
        },

        metadata: result.metadata ?? {},
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          `n8n FAQ workflow timed out after ${this.timeoutMs}ms.`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
