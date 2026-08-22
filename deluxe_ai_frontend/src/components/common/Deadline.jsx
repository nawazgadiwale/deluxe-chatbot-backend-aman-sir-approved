"use client";

import { useState } from "react";

import { Calendar } from "lucide-react";

import { useChatContext } from "../../context/ChatContext";

export default function DeadlineInput() {
  const { sendMessage, loading } = useChatContext();

  const [value, setValue] = useState("");

  const submit = (date) => {
    if (!date || loading) return;

    sendMessage(date);

    setValue("");
  };

  return (
    <div className="space-y-3">
      {/* Calendar */}

      <div className="relative">
        <Calendar
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />

        <input
          type="date"
          disabled={loading}
          className="
            w-full
            rounded-xl
            border
            border-slate-300
            py-3
            pl-10
            pr-4
            text-sm
            outline-none
            focus:border-blue-500
          "
          onChange={(e) => submit(e.target.value)}
        />
      </div>

      {/* Manual input */}

      <input
        value={value}
        disabled={loading}
        placeholder="Or type a delivery date (e.g. 12 Aug 2026)"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            submit(value);
          }
        }}
        className="
          w-full
          rounded-xl
          border
          border-slate-300
          px-4
          py-3
          text-sm
          outline-none
          focus:border-blue-500
        "
      />
    </div>
  );
}