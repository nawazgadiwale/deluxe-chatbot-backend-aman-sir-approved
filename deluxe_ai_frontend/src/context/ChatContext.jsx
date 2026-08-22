"use client";

import { createContext, useContext, useMemo } from "react";

import useChat from "../hooks/useChat";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const chat = useChat();

  const value = useMemo(
    () => chat,
    [
      chat.sessionId,
      chat.messages,
      chat.loading,
      chat.typing,
      chat.handleAction,
      chat.sendMessage,
      chat.clearChat,
      chat.setMessages,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useChatContext must be used inside <ChatProvider>");
  }

  return context;
}
