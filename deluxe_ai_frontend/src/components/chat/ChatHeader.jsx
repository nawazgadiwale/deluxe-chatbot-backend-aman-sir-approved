"use client";

import { Bot, Sparkles, RotateCcw, Minimize2, X } from "lucide-react";

import { useChatContext } from "../../context/ChatContext";

export default function ChatHeader({ onClose, onMinimize }) {
  const { clearChat } = useChatContext();

  return (
    <header
      className="
        relative
        overflow-hidden

        border-b
        border-slate-200

        bg-gradient-to-r
        from-slate-900
        via-slate-800
        to-slate-900

        px-5
        py-4

        text-white
      "
    >
      {/* Decorative Glow */}

      <div
        className="
          absolute
          -right-10
          -top-10

          h-32
          w-32

          rounded-full

          bg-blue-500/20

          blur-3xl
        "
      />

      <div className="relative flex items-center justify-between">
        {/* ==========================================
            Left
        ========================================== */}

        <div className="flex items-center gap-4">
          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center

              rounded-2xl

              bg-gradient-to-br
              from-blue-500
              to-indigo-600

              shadow-lg
            "
          >
            <Bot size={22} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">Deluxe AI</h2>

              <span
                className="
                  flex
                  items-center
                  gap-1

                  rounded-full

                  bg-green-500/20

                  px-2
                  py-0.5

                  text-[10px]
                  font-semibold

                  text-green-300
                "
              >
                <span className="h-2 w-2 rounded-full bg-green-400" />
                ONLINE
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-300">
              Printing Sales Assistant
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Sparkles size={13} className="text-yellow-300" />

              <span className="text-xs text-slate-300">
                Recommendations • Orders • Quotes
              </span>
            </div>
          </div>
        </div>

        {/* ==========================================
            Right
        ========================================== */}

        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            title="New Conversation"
            className="
              rounded-xl
              p-2

              transition

              hover:bg-white/10
            "
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={onMinimize}
            title="Minimize"
            className="
              rounded-xl
              p-2

              transition

              hover:bg-white/10
            "
          >
            <Minimize2 size={18} />
          </button>

          <button
            onClick={onClose}
            title="Close"
            className="
              rounded-xl
              p-2

              transition

              hover:bg-red-500
            "
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
