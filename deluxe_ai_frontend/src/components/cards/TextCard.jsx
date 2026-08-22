"use client";

export default function TextCard({ text }) {
  if (!text) return null;

  return (
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        px-5
        py-4
        text-sm
        leading-7
        text-slate-700
        shadow-sm
      "
    >
      {text}
    </div>
  );
}