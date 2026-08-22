"use client";

import { Bot, User } from "lucide-react";

export default function Avatar({
  type = "bot",
}) {
  const isBot = type === "bot";

  return (
    <div
      className={`
        flex
        h-10
        w-10
        items-center
        justify-center
        rounded-full
        text-white
        shrink-0

        ${
          isBot
            ? "bg-gradient-to-br from-blue-600 to-indigo-600"
            : "bg-slate-700"
        }
      `}
    >
      {isBot ? (
        <Bot size={18} />
      ) : (
        <User size={18} />
      )}
    </div>
  );
}