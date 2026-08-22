"use client";


import ProductDetailsRenderer from "./ProductsDetailsRenderer";

import DiscoveryRenderer from "./DiscoveryRenderer";
import SalesRenderer from "./SalesRenderer";
import LeadRenderer from "./LeadRenderer";
import FAQRenderer from "./FAQRenderer";
import SupportRenderer from "./SupportRenderer";
import MarkdownRenderer from "./MarkdownRenderer";
import ErrorRenderer from "./ErrorRenderer";
import TextCard from "../cards/TextCard";

export default function ResponseRenderer({ message, onAction }) {
  if (!message) {
    return null;
  }

  // =====================================================
  // USER MESSAGE
  // =====================================================

  if (message.role === "user") {
    return <TextCard text={message.content} />;
  }

  // =====================================================
  // NORMALIZE API RESPONSE
  // =====================================================

  /*
    Backend returns:

    {
      success: true,
      sessionId: "...",
      response: {
        type: "sales",
        message: null,
        data: {
          message: "...",
          actions: [...]
        }
      }
    }

    Renderer needs:

    {
      type: "sales",
      message: null,
      data: {...},
      actions: [...]
    }
  */

  const response =
    message?.response && typeof message.response === "object"
      ? message.response
      : message;

  // =====================================================
  // ASSISTANT RESPONSE
  // =====================================================

  const {
    type = "text",
    message: responseMessage = "",
    data = {},
    actions = [],
  } = response;

  // =====================================================
  // ACTIONS
  // =====================================================

  const rendererActions = actions?.length > 0 ? actions : (data?.actions ?? []);

  // =====================================================
  // MESSAGE TEXT
  // =====================================================

  const text = responseMessage || data?.message || "";

  // =====================================================
  // DEBUG
  // =====================================================

  console.log("========== RESPONSE RENDERER ==========");

  console.log("RAW MESSAGE:", message);

  console.log("NORMALIZED RESPONSE:", response);

  console.log("TYPE:", type);

  console.log("MESSAGE:", text);

  console.log("DATA:", data);

  console.log("ACTIONS:", rendererActions);

  console.log("=======================================");

  // =====================================================
  // RESPONSE TYPES
  // =====================================================

  switch (type) {
    // ---------------------------------------------------
    // PRODUCT DETAILS
    // ---------------------------------------------------

    case "product_details":
    case "PRODUCT_DETAILS":
      return <ProductDetailsRenderer data={data} actions={rendererActions} />;

   
    // ---------------------------------------------------
    // DISCOVERY
    // ---------------------------------------------------

    case "discovery":
      return <DiscoveryRenderer data={data} actions={rendererActions} />;

    // ---------------------------------------------------
    // SALES
    // ---------------------------------------------------

    case "sales":
      if (data?.workflow === "LEAD") {
        return (
          <LeadRenderer
            data={data}
            message={text}
            actions={rendererActions}
            onAction={onAction}
          />
        );
      }

      return (
        <SalesRenderer
          data={data}
          message={text}
          actions={rendererActions}
          onAction={onAction}
        />
      );

    // ---------------------------------------------------
    // SALES COMPLETED
    // ---------------------------------------------------

    case "sales_completed":
      return (
        <SalesRenderer
          data={data}
          message={text}
          actions={rendererActions}
          onAction={onAction}
        />
      );

    // ---------------------------------------------------
    // LEAD
    // ---------------------------------------------------

    case "lead":
      return (
        <LeadRenderer
          data={data}
          message={text}
          actions={rendererActions}
          onAction={onAction}
        />
      );

    // ---------------------------------------------------
    // FAQ
    // ---------------------------------------------------

    case "faq":
      return (
        <FAQRenderer data={data} message={text} actions={rendererActions} />
      );

    // ---------------------------------------------------
    // SUPPORT
    // ---------------------------------------------------

    case "support":
      return (
        <SupportRenderer data={data} message={text} actions={rendererActions} />
      );

    // ---------------------------------------------------
    // QUOTATION
    // ---------------------------------------------------

    case "quotation":
      return (
        <MarkdownRenderer
          text={data?.summary ?? text}
          actions={rendererActions}
        />
      );

    // ---------------------------------------------------
    // OUT OF SCOPE
    // ---------------------------------------------------

    case "out_of_scope":
      return (
        <MarkdownRenderer
          text={data?.message ?? text}
          actions={rendererActions}
        />
      );

    // ---------------------------------------------------
    // ERROR
    // ---------------------------------------------------

    case "error":
      return <ErrorRenderer message={text} />;

    // ---------------------------------------------------
    // TEXT
    // ---------------------------------------------------

    case "text":
    default:
      return <MarkdownRenderer text={text} actions={rendererActions} />;
  }
}
