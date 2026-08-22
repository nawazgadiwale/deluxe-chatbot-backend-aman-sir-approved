"use client";

import { Bot, User } from "lucide-react";
import { motion } from "framer-motion";

import ResponseRenderer from "../renderer/ResponseRenderer";

export default function ChatMessage({ message, onAction }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.2,
      }}
      className={`mb-6 flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <>
          <div
            className="
              mr-3
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-gradient-to-br
              from-blue-600
              to-indigo-600
              text-white
              shadow-md
            "
          >
            <Bot size={18} />
          </div>

          <div className="w-full max-w-5xl">
            <div className="mb-2 text-xs font-medium text-slate-400">
              Deluxe AI
            </div>

            <ResponseRenderer message={message} onAction={onAction} />
          </div>
        </>
      )}

      {isUser && (
        <>
          <div className="max-w-[75%]">
            <div className="mb-2 text-right text-xs font-medium text-slate-400">
              You
            </div>

            <div
              className="
                rounded-3xl
                rounded-br-lg
                bg-gradient-to-r
                from-blue-600
                to-indigo-600
                px-5
                py-4
                text-sm
                leading-7
                text-white
                shadow-lg
              "
            >
              {message.content}
            </div>
          </div>

          <div
            className="
              ml-3
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-slate-900
              text-white
              shadow-md
            "
          >
            <User size={18} />
          </div>
        </>
      )}
    </motion.div>
  );
}
