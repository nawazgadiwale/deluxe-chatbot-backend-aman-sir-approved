"use client";

import { AlertCircle } from "lucide-react";

export default function ErrorRenderer({
  message,
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-red-200
        bg-red-50
        p-5
      "
    >
      <div className="flex items-center gap-3">

        <AlertCircle
          size={22}
          className="text-red-600"
        />

        <div>

          <h3 className="font-semibold text-red-700">
            Something went wrong
          </h3>

          <p className="mt-1 text-sm text-red-600">
            {message}
          </p>

        </div>

      </div>
    </div>
  );
}