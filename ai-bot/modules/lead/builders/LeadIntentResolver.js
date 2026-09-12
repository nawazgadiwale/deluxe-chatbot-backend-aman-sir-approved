import LeadConstants from "../helpers/LeadConstants.js";

export default class LeadIntentResolver {
  resolve(message = "") {
    const text = String(message).toLowerCase().trim();

    if (
      text.includes("request quotation") ||
      text.includes("request a quotation") ||
      text.includes("request quote") ||
      text.includes("quotation") ||
      text.includes("get a quote") ||
      text.includes("get quote") ||
      text.includes("need a quote") ||
      text.includes("need quotation") ||
      text.includes("want a quote") ||
      text.includes("want quotation")
    ) {
      return {
        capability: "lead",

        requestType: LeadConstants.REQUEST_TYPES.QUOTATION,

        confidence: 1,

        source: "RULE",
      };
    }

    if (
      text.includes("talk to an expert") ||
      text.includes("talk to expert") ||
      text.includes("connect with expert") ||
      text.includes("connect to expert") ||
      text.includes("printing expert") ||
      text.includes("speak to an expert") ||
      text.includes("speak with an expert")
    ) {
      return {
        capability: "lead",

        requestType: LeadConstants.REQUEST_TYPES.EXPERT,

        confidence: 1,

        source: "RULE",
      };
    }

    if (
      text.includes("contact sales") ||
      text.includes("contact the sales team") ||
      text.includes("talk to sales") ||
      text.includes("speak to sales") ||
      text.includes("connect with sales")
    ) {
      return {
        capability: "lead",

        requestType: LeadConstants.REQUEST_TYPES.CONTACT_SALES,

        confidence: 1,

        source: "RULE",
      };
    }

    return null;
  }
}
