"use client";

import { Inbox } from "lucide-react";

export default function EmptyState({
  title = "Nothing here yet",
  description = "",
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        className="
          mb-5
          flex
          h-16
          w-16
          items-center
          justify-center
          rounded-full
          bg-slate-100
        "
      >
        <Inbox size={28} className="text-slate-500" />
      </div>

      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>

      {description && (
        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}
