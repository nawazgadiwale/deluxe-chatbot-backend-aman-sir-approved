import BaseAgent from "./BaseAgent.js";
import ResponseBuilder from "../../core/responses/Apiresponse.js";
import SupportService from "../../modules/support/SupportService.js";

const responseBuilder = new ResponseBuilder();
const faqService = new SupportService();

export default class FAQAgent extends BaseAgent {
  async execute(state = {}) {
    try {
      const result = await faqService.generate(state);

      state.rag = {
        context: result.context ?? "",
        documents: result.documents ?? [],
      };

      state.response = responseBuilder.faq(
        result.answer,
        {
          source: "n8n",
          references: result.references ?? [],
          ...(result.metadata ?? {}),
        },
      );

      return state;
    } catch (error) {
      console.error("FAQ n8n ERROR:", error);

      const fallbackAnswer =
        this.getFallbackAnswer(state) ??
        "Our customer support team is available Monday to Saturday, 9:00 AM to 7:00 PM (GST). We deliver across Dubai and all other Emirates in the UAE. Please let us know how we can assist you with your printing needs!";

      state.rag = {
        context: "",
        documents: [],
      };

      state.response = responseBuilder.faq(
        fallbackAnswer,
        {
          source: "faq_fallback",
          serviceUnavailable: true,
          error: error.message,
        },
      );

      return state;
    }
  }

  getFallbackAnswer(state = {}) {
    const q = String(
      state.userMessage ??
      state.message ??
      "",
    )
      .toLowerCase()
      .trim();

    if (!q) return null;

    if (
      q.includes("outside dubai") ||
      q.includes("outside uae") ||
      q.includes("abu dhabi") ||
      q.includes("sharjah") ||
      q.includes("ajman") ||
      q.includes("other emirates")
    ) {
      return "Yes, we deliver across all Emirates in the UAE including Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Umm Al Quwain, and Fujairah. Delivery charges and turnaround times vary based on location and order size.";
    }

    if (
      q.includes("deliver") ||
      q.includes("shipping") ||
      q.includes("courier")
    ) {
      return "We offer reliable doorstep delivery across Dubai and all other Emirates in the UAE. Express delivery options are also available for select products.";
    }

    if (
      q.includes("business hours") ||
      q.includes("working hours") ||
      q.includes("office hours") ||
      q.includes("open") ||
      q.includes("timing")
    ) {
      return "Our business hours are Monday through Saturday, 9:00 AM to 7:00 PM (GST). We are closed on Sundays.";
    }

    if (
      q.includes("location") ||
      q.includes("where are you") ||
      q.includes("store location") ||
      q.includes("office location")
    ) {
      return "We are based in Dubai, UAE. You can place your orders directly online via WhatsApp or our website, and we deliver directly to your doorstep.";
    }

    return null;
  }
}