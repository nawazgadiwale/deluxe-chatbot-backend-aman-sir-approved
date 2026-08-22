"use client";

import { Briefcase, FolderOpen, Star, Target } from "lucide-react";

export default function ProductMeta({ product = {} }) {
  const chips = [];

  if (product.mainCategory || product.category) {
    chips.push({
      icon: <FolderOpen size={14} />,
      value: product.mainCategory ?? product.category,
    });
  }

  if (product.subCategory) {
    chips.push({
      icon: <Briefcase size={14} />,
      value: product.subCategory,
    });
  }

  if (product.score) {
    chips.push({
      icon: <Star size={14} />,
      value: `${Number(product.score).toFixed(1)}`,
    });
  }

  if (product.reason) {
    chips.push({
      icon: <Target size={14} />,
      value: "Recommended",
    });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip, index) => (
        <div
          key={index}
          className="
            inline-flex
            items-center
            gap-2
            rounded-full
            border
            border-slate-200
            bg-slate-50
            px-3
            py-1.5
            text-xs
            font-medium
            text-slate-700
          "
        >
          <span className="text-blue-600">{chip.icon}</span>

          <span>{chip.value}</span>
        </div>
      ))}
    </div>
  );
}
