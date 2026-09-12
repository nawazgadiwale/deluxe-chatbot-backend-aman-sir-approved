import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { jsonrepair } from "jsonrepair";
import BaseProvider from "./BaseProvider.js";

export default class GeminiProvider extends BaseProvider {
  constructor() {
    super();
    this.models = new Map();
  }

  getModel(options = {}) {
    const config = {
      model:
        options.model ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",

      temperature: options.temperature ?? 0,

      topP: options.topP ?? 0.8,

      maxOutputTokens: options.maxOutputTokens ?? options.numPredict ?? 600,

      apiKey: options.apiKey ?? process.env.GOOGLE_API_KEY,
    };

    if (!config.apiKey) {
      throw new Error("GOOGLE_API_KEY is missing.");
    }

    const key = JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      topP: config.topP,
      maxOutputTokens: config.maxOutputTokens,
    });

    if (!this.models.has(key)) {
      this.models.set(key, new ChatGoogleGenerativeAI(config));
    }

    console.log("================================");
    console.log("GEMINI CONFIG");
    console.log("================================");
    console.log("Model:", config.model);
    console.log("API Key:", config.apiKey ? "YES" : "NO");
    console.log("================================");

    return this.models.get(key);
  }

  /*
   * ============================================================
   * NORMAL TEXT
   * ============================================================
   */

  async invoke({ systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);
    const timeoutMs =
      Number(options.timeoutMs || process.env.GEMINI_TIMEOUT_MS) || 8000;
    const modelName =
      process.env.GEMINI_MODEL ?? options.model ?? "gemini-3.5-flash-lite";
    const correlationId =
      options.correlationId || `req_${Date.now().toString(36)}`;
    const start = Date.now();

    console.log(
      `[GEMINI][REQUEST_START] model=${modelName} correlationId=${correlationId} timeoutMs=${timeoutMs}`,
    );

    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const elapsedMs = Date.now() - start;
        console.warn(
          `[GEMINI][REQUEST_TIMEOUT] model=${modelName} correlationId=${correlationId} elapsedMs=${elapsedMs}`,
        );
        const timeoutErr = new Error(
          `Gemini request timed out after ${timeoutMs}ms`,
        );
        timeoutErr.code = "ETIMEDOUT";
        reject(timeoutErr);
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    });

    let response;
    try {
      response = await Promise.race([
        model.invoke([
          {
            role: "system",
            content: systemPrompt ?? "",
          },
          {
            role: "user",
            content: userMessage ?? "",
          },
        ]),
        timeoutPromise,
      ]);
      const elapsedMs = Date.now() - start;
      console.log(
        `[GEMINI][REQUEST_SUCCESS] model=${modelName} correlationId=${correlationId} elapsedMs=${elapsedMs}`,
      );
    } catch (error) {
      const elapsedMs = Date.now() - start;
      if (error.code !== "ETIMEDOUT") {
        console.error(
          `[GEMINI][REQUEST_ERROR] model=${modelName} correlationId=${correlationId} elapsedMs=${elapsedMs} error=${error.message}`,
        );
      }
      throw error;
    }

    this.logUsage(response);

    return this.extractText(response?.content);
  }

  /*
   * ============================================================
   * STRUCTURED OUTPUT
   * ============================================================
   */

  async invokeStructured({ schema, systemPrompt, userMessage, ...options }) {
    const model = this.getModel({
      ...options,
      maxOutputTokens: options.maxOutputTokens ?? 600,
    });
    const timeoutMs =
      Number(options.timeoutMs || process.env.GEMINI_TIMEOUT_MS) || 8000;
    const modelName =
      process.env.GEMINI_MODEL ?? options.model ?? "gemini-3.5-flash-lite";
    const correlationId =
      options.correlationId || `req_${Date.now().toString(36)}`;
    const start = Date.now();

    const schemaPrompt = `
Return ONLY one valid JSON object.

Do not return markdown.
Do not return code fences.
Do not return explanations.
Do not return comments.
Do not return text before the JSON.
Do not return text after the JSON.

The response MUST follow this schema:

${JSON.stringify(schema, null, 2)}

Return ONLY JSON.
`;

    const finalSystemPrompt = `
${systemPrompt ?? ""}

${schemaPrompt}
`;

    console.log(
      `[GEMINI][REQUEST_START] model=${modelName} correlationId=${correlationId} timeoutMs=${timeoutMs}`,
    );

    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const elapsedMs = Date.now() - start;
        console.warn(
          `[GEMINI][REQUEST_TIMEOUT] model=${modelName} correlationId=${correlationId} elapsedMs=${elapsedMs}`,
        );
        const timeoutErr = new Error(
          `Gemini request timed out after ${timeoutMs}ms`,
        );
        timeoutErr.code = "ETIMEDOUT";
        reject(timeoutErr);
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    });

    let response;

    try {
      response = await Promise.race([
        model.invoke([
          {
            role: "system",
            content: finalSystemPrompt,
          },
          {
            role: "user",
            content: userMessage ?? "",
          },
        ]),
        timeoutPromise,
      ]);
      const elapsedMs = Date.now() - start;
      console.log(
        `[GEMINI][REQUEST_SUCCESS] model=${modelName} correlationId=${correlationId} elapsedMs=${elapsedMs}`,
      );
    } catch (error) {
      const elapsedMs = Date.now() - start;
      if (error.code !== "ETIMEDOUT") {
        console.error(
          `[GEMINI][REQUEST_ERROR] model=${modelName} correlationId=${correlationId} elapsedMs=${elapsedMs} error=${error.message}`,
        );
      }
      throw error;
    }

    this.logUsage(response);

    let text = this.extractText(response?.content);

    text = String(text ?? "").trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    /*
     * Remove thinking tags if present.
     */

    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    /*
     * Remove markdown fences.
     */

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    /*
     * Extract JSON.
     */

    const jsonText = this.extractJsonObject(text);

    if (!jsonText) {
      throw new Error(`Gemini returned invalid JSON.\n\n${text}`);
    }

    /*
     * Repair JSON.
     */

    let repaired;

    try {
      repaired = jsonrepair(jsonText);
    } catch (error) {
      console.error("Gemini JSON repair failed.");

      console.error("JSON received:");

      console.error(jsonText);

      throw error;
    }

    /*
     * Parse.
     */

    try {
      return JSON.parse(repaired);
    } catch (error) {
      console.error("Gemini JSON parse failed.");

      console.error("Repaired JSON:");

      console.error(repaired);

      throw new Error(`Gemini returned invalid JSON: ${error.message}`);
    }
  }

  /*
   * ============================================================
   * STREAM
   * ============================================================
   */

  async stream({ systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);

    return model.stream([
      {
        role: "system",
        content: systemPrompt ?? "",
      },
      {
        role: "user",
        content: userMessage ?? "",
      },
    ]);
  }

  /*
   * ============================================================
   * TEXT EXTRACTION
   * ============================================================
   */

  extractText(content) {
    if (content == null) {
      return "";
    }

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          return part?.text ?? part?.content ?? "";
        })
        .join("");
    }

    if (typeof content === "object") {
      return content.text ?? content.content ?? JSON.stringify(content);
    }

    return String(content);
  }

  /*
   * ============================================================
   * JSON EXTRACTION
   * ============================================================
   */

  extractJsonObject(text = "") {
    const start = text.indexOf("{");

    if (start === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        depth++;
      }

      if (char === "}") {
        depth--;

        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    /*
     * If Gemini truncated the JSON, let
     * jsonrepair attempt to repair it.
     */

    return text.slice(start);
  }

  /*
   * ============================================================
   * USAGE
   * ============================================================
   */

  logUsage(response) {
    const usage =
      response?.usage_metadata ??
      response?.response_metadata?.tokenUsage ??
      null;

    if (!usage) {
      return;
    }

    console.log("================================");
    console.log("GEMINI TOKEN USAGE");
    console.log("================================");

    console.table({
      "Prompt Tokens":
        usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens ?? null,

      "Completion Tokens":
        usage.output_tokens ??
        usage.completionTokens ??
        usage.outputTokens ??
        null,

      "Total Tokens": usage.total_tokens ?? usage.totalTokens ?? null,
    });

    console.log("================================");
  }
}
