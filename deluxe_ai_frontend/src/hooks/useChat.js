"use client";

import { useCallback, useState } from "react";

import chatService from "../services/ChatService";
import sessionService from "../services/SessionService";
import LeadRenderer from "../components/renderer/LeadRenderer";

export default function useChat() {
  const [sessionId, setSessionId] = useState(() =>
    sessionService.getSessionId(),
  );

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);

  // --------------------------------------------------
  // Create message
  // --------------------------------------------------

  const createMessage = ({
    role,
    type = "text",
    content = "",
    message = "",
    data = {},
    actions = [],
    metadata = {},
  }) => ({
    id: crypto.randomUUID(),
    role,
    type,
    content,
    message,
    data,
    actions,
    metadata,
    createdAt: new Date().toISOString(),
  });

  // --------------------------------------------------
  // Add user message
  // --------------------------------------------------

  const addUserMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      createMessage({
        role: "user",
        content: text,
      }),
    ]);
  };

  // --------------------------------------------------
  // Add assistant message
  // --------------------------------------------------

  const addAssistantMessage = (response) => {
    console.log("========== FRONTEND RESPONSE ==========");
    console.dir(response, { depth: null });

    const payload = response?.data ?? response?.context ?? response;

    console.log("========== FRONTEND PAYLOAD ==========");
    console.dir(payload, { depth: null });

    setMessages((prev) => [
      ...prev,
      createMessage({
        role: "assistant",
        type: response?.type ?? "text",
        message: response?.message ?? "",
        data: payload,
        metadata: payload,
        actions: response?.actions ?? [],
      }),
    ]);
  };

  // --------------------------------------------------
  // Render assistant content
  // --------------------------------------------------

  const renderAssistantContent = (message) => {
    const data = message.data ?? message.metadata ?? {};

    // --------------------------------------------------
    // LEAD FORM
    // --------------------------------------------------

    if (
      message.type === "lead" &&
      (data.status === "COLLECTING_CUSTOMER" ||
        data.response?.step === "COLLECT_CUSTOMER" ||
        data.form?.step === "COLLECT_CUSTOMER")
    ) {
      return (
        <LeadRenderer
          data={data}
          message={message.message}
          onAction={handleAction}
        />
      );
    }

    // --------------------------------------------------
    // COMPLETED LEAD
    // --------------------------------------------------

    if (message.type === "lead" && (data.status === "COMPLETED" || data.lead)) {
      return (
        <LeadRenderer
          data={data}
          message={message.message}
          onAction={handleAction}
        />
      );
    }

    // --------------------------------------------------
    // NORMAL MESSAGE
    // --------------------------------------------------

    return null;
  };

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------

  const sendMessage = useCallback(
    async (text = "", action = null) => {
      const message = text?.trim() ?? "";

      if (!message && !action) return;
      if (loading) return;

      // Show button click as user message
      if (message) {
        addUserMessage(message);
      } else if (action?.label) {
        addUserMessage(action.label);
      }

      setLoading(true);
      setTyping(true);

      try {
        const response = await chatService.sendMessage(
          sessionId,
          message,
          action,
        );

        addAssistantMessage(response);
      } catch (error) {
        console.error("Chat error:", error);

        addAssistantMessage({
          type: "error",
          message: error?.message || "Something went wrong.",
        });
      } finally {
        setTyping(false);
        setLoading(false);
      }
    },
    [loading, sessionId],
  );

  // --------------------------------------------------
  // Backend actions
  // --------------------------------------------------

  const FORWARD_ACTIONS = new Set([
    // Product
    "START_ORDER",
    "ORDER_PRODUCT",
    "SHOW_PRODUCT_DETAILS",
    "GET_QUOTE",
    "CONTACT_SALES",

    // Sales
    "SELECT_PRODUCT",
    "SHOW_SELECTIONS",
    "SELECT_SELECTION",
    "COLLECT_PRODUCT_FIELD",
    "COLLECT_REQUIREMENT",
    "SELECT_ADDONS",
    "SKIP_ADDONS",
    "COLLECT_QUANTITY",
    "EDIT_ORDER",
    "COLLECT_ARTWORK",
    "SELECT_DELIVERY_METHOD",
    "ASK_DELIVERY_ADDRESS",
    "ASK_DELIVERY_DATE",
    "REVIEW_ORDER",
    "CONFIRM_ORDER",
    "CANCEL_ORDER",
    "ORDER_COMPLETED",

    // Lead
    "COLLECT_CUSTOMER",
    "SUBMIT_LEAD",
  ]);

  // --------------------------------------------------
  // Handle action
  // --------------------------------------------------

  const handleAction = useCallback(
    (action) => {
      if (!action) return;

      console.log("========== FRONTEND ACTION ==========");

      console.log("Action:", action);

      // Forward backend actions directly
      if (FORWARD_ACTIONS.has(action.id)) {
        console.log("Forwarding action:", action.id);

        console.log("Payload:", action.payload);

        sendMessage("", action);

        return;
      }

      // Custom actions
      switch (action.id) {
        case "SEND_PROFILE":
          sendMessage("Send me your company profile");
          break;

        case "CONTACT_SUPPORT":
          sendMessage("I need customer support");
          break;

        default:
          console.warn("Unhandled action:", action.id);
      }
    },
    [sendMessage],
  );

  // --------------------------------------------------
  // Clear chat
  // --------------------------------------------------

  const clearChat = () => {
    const id = sessionService.newSession();

    setSessionId(id);
    setMessages([]);
  };

  // --------------------------------------------------
  // Return
  // --------------------------------------------------

  return {
    sessionId,
    messages,
    loading,
    typing,
    sendMessage,
    handleAction,
    clearChat,
    setMessages,
  };
}
