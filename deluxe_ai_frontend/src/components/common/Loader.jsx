"use client";

import { LoaderCircle } from "lucide-react";

export default function Loader({
  text = "Loading...",
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <LoaderCircle
        size={20}
        className="animate-spin text-blue-600"
      />

      <span className="text-sm text-slate-600">
        {text}
      </span>
    </div>
  );
}