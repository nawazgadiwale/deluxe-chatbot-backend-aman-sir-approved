"use client";

export default function Skeleton({
  className = "",
}) {
  return (
    <div
      className={`
        animate-pulse
        rounded-xl
        bg-slate-200
        ${className}
      `}
    />
  );
}