"use client";

import { Bot, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function SummaryCard({ title = "Deluxe AI", summary, icon }) {
  if (!summary) return null;

  const Icon = icon ?? Sparkles;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.25,
      }}
      className="
        rounded-3xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
      "
    >
      {/* Header */}

      <div className="flex items-center gap-3">
        <div
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            bg-blue-600
            text-white
          "
        >
          <Bot size={18} />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{title}</h3>

            <Icon size={15} className="text-blue-500" />
          </div>

          <p className="text-xs text-slate-500">AI Sales Assistant</p>
        </div>
      </div>

      {/* Response */}

      <div
        className="
          mt-5
          text-[15px]
          leading-8
          text-slate-700
          whitespace-pre-line
        "
      >
        {summary}
      </div>
    </motion.div>
  );
}
