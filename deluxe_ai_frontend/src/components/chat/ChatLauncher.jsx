"use client";

import { BotMessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function ChatLauncher({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        scale: 1.08,
      }}
      whileTap={{
        scale: 0.95,
      }}
      transition={{
        duration: 0.25,
      }}
      className=" fixed bottom-6 right-6 z-[9999] group"
    >
      {/* Pulse Ring */}
      <span
        className=" absolute inset-0 rounded-full bg-blue-500/20 animate-ping"
      />

      {/* Main Button */}
      <div
        className="
          relative
          flex
          h-16
          w-16
          items-center
          justify-center
          rounded-full
          bg-gradient-to-br
          from-blue-600
          to-indigo-600
          text-white
          shadow-2xl
          transition-all
          duration-300
          group-hover:shadow-blue-300/50
        "
      >
        <BotMessageSquare className="h-8 w-8" />

        {/* Online Indicator */}
        <span
          className="
            absolute
            right-1
            top-1
            h-4
            w-4
            rounded-full
            border-2
            border-white
            bg-green-500
          "
        />
      </div>

      {/* Tooltip */}
      <div
        className="
          absolute
          right-20
          top-1/2
          hidden
          -translate-y-1/2
          whitespace-nowrap
          rounded-xl
          bg-slate-900
          px-4
          py-2
          text-sm
          font-medium
          text-white
          shadow-xl
          group-hover:block
        "
      >
        Chat with Deluxe AI
      </div>
    </motion.button>
  );
}
