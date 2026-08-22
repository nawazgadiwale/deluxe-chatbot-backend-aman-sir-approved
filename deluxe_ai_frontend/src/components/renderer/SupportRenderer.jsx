"use client";

import { LifeBuoy, Phone, Mail, MessageCircle } from "lucide-react";

import SummaryCard from "../cards/SummaryCard";
import ActionButton from "../cards/ActionButton";

export default function SupportRenderer({
  data = {},
  message = "",
  actions = [],
}) {
  const summary = data.answer ?? data.summary ?? data.message ?? message;

  return (
    <div className="space-y-5">
      {/* ==========================================
          AI Answer
      ========================================== */}

      {summary && (
        <SummaryCard
          title="Customer Support"
          summary={summary}
          icon={LifeBuoy}
        />
      )}

      {/* ==========================================
          Contact Details
      ========================================== */}

      {(data.phone || data.email || data.contact) && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold text-slate-900">
            Contact Information
          </h3>

          <div className="space-y-4">
            {data.phone && (
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2">
                  <Phone size={18} className="text-blue-600" />
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400">Phone</div>

                  <div className="font-medium">{data.phone}</div>
                </div>
              </div>
            )}

            {data.email && (
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2">
                  <Mail size={18} className="text-blue-600" />
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400">Email</div>

                  <div className="font-medium">{data.email}</div>
                </div>
              </div>
            )}

            {data.contact && (
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2">
                  <MessageCircle size={18} className="text-blue-600" />
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400">
                    Contact
                  </div>

                  <div className="font-medium">{data.contact}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          Follow Up
      ========================================== */}

      {data.followUpQuestion && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="font-semibold text-slate-900">Next Step</div>

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
