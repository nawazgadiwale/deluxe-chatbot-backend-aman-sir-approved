import { ChatGroq } from "@langchain/groq";
import { jsonrepair } from "jsonrepair";

import BaseProvider from "./BaseProvider.js";

export default class GroqProvider extends BaseProvider {
  constructor() {
    super();
    this.models = new Map();
  }

  getModel(options = {}) {
    const config = {
      // apiKey: process.env.GROQ_API_KEY,

      apiKey: process.env.LLAMA_RATE_LIMIT_ALTERNATE,

      // apiKey: process.env.LLAMA_API_KEY,

      // model:
      // options.model ?? process.env.LLAMA_MODEL ?? "llama-3.3-70b-versatile",

      model: options.model ?? process.env.GROQ_MODEL ?? "groq/compound",

      // model:
      //   options.model ??
      //   process.env.LLAMA_ALTERNATE_MODEL ??
      //   "llama-3.1-8b-instant",

      temperature: options.temperature ?? 0,

      maxTokens: options.maxTokens ?? 600,

      topP: options.topP ?? 0.8,
    };

    const key = JSON.stringify(config);

    if (!this.models.has(key)) {
      this.models.set(key, new ChatGroq(config));
    }

    console.log("================================");
    console.log("Using Model :", config.model);
    console.log("API Exists  :", !!config.apiKey);
    console.log("API Length  :", config.apiKey?.length);
    console.log("API Prefix  :", config.apiKey?.substring(0, 8));
    console.log("================================");
    return this.models.get(key);
  }

  /*
   * =====================================================
   * Normal Text
   * =====================================================
   */

  async invoke({ systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);

    const response = await model.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ]);

    const usage =
      response.usage_metadata ?? response.response_metadata?.tokenUsage ?? null;

    // console.log("================================");
    // console.log("GROQ TOKEN USAGE");
    // console.log("================================");

    if (usage) {
      console.table({
        "Prompt Tokens": usage.input_tokens ?? usage.promptTokens,

        "Completion Tokens": usage.output_tokens ?? usage.completionTokens,

        "Total Tokens": usage.total_tokens ?? usage.totalTokens,
      });
    } else {
      console.log("No token usage returned.");
    }

    console.log("================================");

    return this.sanitizeResponse(response.content);
  }

  /*
   * =====================================================
   * Structured Output (JSON Mode)
   * =====================================================
   */
  async invokeStructured({ schema, systemPrompt, userMessage, ...options }) {
    const model = this.getModel(options);

    const schemaPrompt = `
Return ONLY valid JSON.

The JSON must follow this schema:

${JSON.stringify(schema, null, 2)}

Return only JSON.
`;

    const finalSystemPrompt = `${systemPrompt}\n${schemaPrompt}`;

    // console.log("================================");
    // console.log("LLM REQUEST");
    // console.log("================================");
    // console.log("System Prompt Length :", finalSystemPrompt.length);
    // console.log("User Message         :", userMessage);
    // console.log("================================");

    const response = await model.invoke([
      {
        role: "system",
        content: finalSystemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ]);

    /*
     * =====================================================
     * Token Usage
     * =====================================================
     */

    const usage =
      response.usage_metadata ?? response.response_metadata?.tokenUsage ?? null;

    // console.log("================================");
    // console.log("TOKEN USAGE");
    // console.log("================================");

    if (usage) {
      console.table({
        "Prompt Tokens": usage.input_tokens ?? usage.promptTokens,

        "Completion Tokens": usage.output_tokens ?? usage.completionTokens,

        "Total Tokens": usage.total_tokens ?? usage.totalTokens,
      });
    } else {
      console.log("No usage metadata returned.");
    }

    console.log("================================");

    /*
     * =====================================================
     * Raw Response
     * =====================================================
    //  */

    // console.log("RAW RESPONSE");
    // console.log("================================");

    // console.dir(response, { depth: null });

    // console.log("================================");

    let text = response.content;

    if (Array.isArray(text)) {
      text = text.map((part) => part.text ?? "").join("");
    }

    text = String(text);

    // console.log("RAW TEXT");
    // console.log("================================");
    // console.log(text);
    // console.log("================================");

    /*
     * =====================================================
     * Remove Markdown
     * =====================================================
     */

    text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    /*
     * =====================================================
     * Remove Think Tags
     * =====================================================
     */

    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    /*
     * =====================================================
     * Extract JSON
     * =====================================================
     */

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error(`Groq returned invalid JSON.\n\n${text}`);
    }

    let json = text.slice(start, end + 1);

    /*
     * =====================================================
     * Repair JSON
     * =====================================================
     */

    try {
      json = jsonrepair(json);
    } catch (err) {
      console.error("JSON Repair Error");
      console.error(json);
      throw err;
    }

    // console.log("PARSED JSON");
    // console.log("================================");
    // console.log(json);
    // console.log("================================");

    /*
     * =====================================================
     * Parse
     * =====================================================
     */

    const parsed = JSON.parse(json);

    // console.log("FINAL OBJECT");
    // console.log("================================");
    // console.dir(parsed, { depth: null });
    // console.log("================================");

    return parsed;
  }
}
