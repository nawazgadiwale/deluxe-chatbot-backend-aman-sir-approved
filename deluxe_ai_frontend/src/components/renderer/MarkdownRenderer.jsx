"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import ActionButton from "../cards/ActionButton";

export default function MarkdownRenderer({
  text = "",
  actions = [],
}) {
  return (
    <div className="space-y-4">

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        "
      >
        <div
          className="
            prose
            prose-slate
            prose-sm
            max-w-none

            prose-headings:text-slate-900
            prose-p:text-slate-700
            prose-strong:text-slate-900
            prose-a:text-blue-600
            prose-li:text-slate-700
            prose-code:text-red-500
            prose-pre:bg-slate-900
          "
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text}
          </ReactMarkdown>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
            />
          ))}
        </div>
      )}

    </div>
  );
}