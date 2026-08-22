"use client";

import { motion } from "framer-motion";

import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

export default function ChatWindow({ onClose, onMinimize }) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.92,
        y: 30,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        scale: 0.92,
        y: 30,
      }}
      transition={{
        duration: 0.25,
      }}
      className="
        fixed
        bottom-6
        right-6
        z-[9999]

        flex
        flex-col

        h-[760px]
        w-[440px]

        max-h-[calc(100vh-32px)]
        max-w-[calc(100vw-24px)]

        overflow-hidden

        rounded-[28px]

        border
        border-slate-200/70

        bg-white

        shadow-[0_25px_80px_rgba(15,23,42,0.18)]

        backdrop-blur-xl

        md:h-[760px]
        md:w-[440px]

        sm:bottom-3
        sm:right-3
      "
    >
      {/* ===============================
          Header
      =============================== */}

      <ChatHeader onClose={onClose} onMinimize={onMinimize} />

      {/* ===============================
          Conversation
      =============================== */}

      <div className="flex min-h-0 flex-1 flex-col bg-[#f8fafc]">
        <ChatMessages />
      </div>

      {/* ===============================
          Input
      =============================== */}

      <ChatInput />
    </motion.div>
  );
}
