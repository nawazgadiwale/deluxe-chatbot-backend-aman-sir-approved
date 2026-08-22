"use client";

import { CircleHelp } from "lucide-react";

import SummaryCard from "../cards/SummaryCard";
import ActionButton from "../cards/ActionButton";

export default function FAQRenderer({ data = {}, message = "", actions = [] }) {
  const answer = data.answer ?? data.summary ?? data.message ?? message;

  return (
    <div className="space-y-5">
      {/* ==========================================
          Answer
      ========================================== */}

      {answer && (
        <SummaryCard
          title="Frequently Asked Question"
          summary={answer}
          icon={CircleHelp}
        />
      )}

      {/* ==========================================
          References
      ========================================== */}

      {(data.references ?? []).length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">References</h3>

          <div className="mt-4 flex flex-wrap gap-2">
            {data.references.map((reference) => (
              <span
                key={reference}
                className="
                  rounded-full
                  bg-slate-100
                  px-3
                  py-2
                  text-xs
                  text-slate-700
                "
              >
                {reference}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================
          Follow Up
      ========================================== */}

      {data.followUpQuestion && (
        <div
          className="
            rounded-2xl
            border
            border-blue-100
            bg-blue-50
            p-5
          "
        >
          <div className="font-semibold text-slate-900">
            Need anything else?
          </div>

          <p className="mt-2 text-sm leading-7 text-slate-700">
            {data.followUpQuestion}
          </p>
        </div>
      )}

      {/* ==========================================
          Actions
      ========================================== */}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
