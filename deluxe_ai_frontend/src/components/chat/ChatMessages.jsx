"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useChatContext } from "../../context/ChatContext";

import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import WelcomeScreen from "./WelcomeScreen";

export default function ChatMessages() {
  const { messages, typing, handleAction } = useChatContext();

  return (
    <div
      className="
        relative
        flex-1
        overflow-y-auto
        bg-[#f8fafc]
      "
    >
      {/* ===============================
          Top Fade
      =============================== */}

      <div
        className="
          pointer-events-none
          sticky
          top-0
          z-10
          h-6
          bg-gradient-to-b
          from-[#f8fafc]
          to-transparent
        "
      />

      {/* ===============================
          Messages Container
      =============================== */}

      <div
        className="
          mx-auto
          flex
          w-full
          max-w-4xl
          flex-col
          px-5
          py-6
        "
      >
        {/* ===============================
            Welcome
        =============================== */}

        {messages.length === 0 && <WelcomeScreen />}

        {/* ===============================
            Messages
        =============================== */}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              layout
              initial={{
                opacity: 0,
                y: 16,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -10,
              }}
              transition={{
                duration: 0.22,
              }}
            >
              <ChatMessage message={message} onAction={handleAction} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ===============================
            Typing Indicator
        =============================== */}

        {typing && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
          >
            <TypingIndicator />
          </motion.div>
        )}
      </div>
    </div>
  );
}
