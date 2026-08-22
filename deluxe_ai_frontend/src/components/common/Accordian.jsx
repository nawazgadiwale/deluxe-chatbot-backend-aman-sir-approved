"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function Accordion({
  title,
  children,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border">

      <button
        onClick={() => setOpen(!open)}
        className="
          flex
          w-full
          items-center
          justify-between
          p-4
          font-semibold
        "
      >
        {title}

        <ChevronDown
          className={
            open
              ? "rotate-180 transition"
              : "transition"
          }
        />
      </button>

      {open && (
        <div className="border-t p-4">
          {children}
        </div>
      )}

    </div>
  );
}