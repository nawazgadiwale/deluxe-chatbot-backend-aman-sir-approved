"use client";

import { Bot } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="mb-6 flex items-start">
      {/* Avatar */}

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

      {/* Bubble */}

      <div className="max-w-sm">
        <div className="mb-2 text-xs font-medium text-slate-400">Deluxe AI</div>

        <div
          className="
            rounded-3xl
            rounded-bl-lg

            border
            border-slate-200

            bg-white

            px-5
            py-4

            shadow-sm
          "
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span
                className="
                  h-2
                  w-2
                  rounded-full
                  bg-blue-500
                  animate-bounce
                "
              />

              <span
                className="
                  h-2
                  w-2
                  rounded-full
                  bg-blue-500
                  animate-bounce
                "
                style={{
                  animationDelay: ".15s",
                }}
              />

              <span
                className="
                  h-2
                  w-2
                  rounded-full
                  bg-blue-500
                  animate-bounce
                "
                style={{
                  animationDelay: ".30s",
                }}
              />
            </div>

            <span className="text-sm text-slate-500">
              Deluxe AI is thinking...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
