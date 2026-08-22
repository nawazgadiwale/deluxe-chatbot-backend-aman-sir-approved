"use client";

import Image from "next/image";
import {
  Package,
  Tag,
  FolderTree,
  Star,
  ArrowRight,
  BadgeDollarSign,
} from "lucide-react";

import ActionButton from "./ActionButton";

export default function ProductCard({ product }) {
  if (!product) return null;

  const {
    name,
    image,
    thumbnail,
    badge,
    shortDescription,
    mainCategory,
    subCategory,
    pricing,
    featured,
    actions = [],
  } = product;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const imageSrc = image
    ? image.startsWith("http")
      ? image
      : `${apiUrl}${image}`
    : thumbnail
      ? thumbnail.startsWith("http")
        ? thumbnail
        : `${apiUrl}${thumbnail}`
      : null;

  return (
    <div
      className="
        overflow-hidden
        rounded-3xl
        border
        border-slate-200
        bg-white
        shadow-md
        transition-all
        duration-300
        hover:-translate-y-1
        hover:shadow-2xl
      "
    >
      {/* ======================================
          IMAGE
      ====================================== */}

      <div className="relative h-64 w-full overflow-hidden bg-slate-100">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={name}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package size={72} className="text-slate-300" />
          </div>
        )}

        {featured && (
          <div className="absolute left-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-white shadow">
            ⭐ Featured
          </div>
        )}

        {badge && (
          <div className="absolute right-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow">
            {badge}
          </div>
        )}
      </div>

      {/* ======================================
          CONTENT
      ====================================== */}

      <div className="space-y-5 p-6">
        {/* Title */}

        <div>
          <h2 className="text-2xl font-bold text-slate-900">{name}</h2>

          {shortDescription && (
            <p className="mt-3 leading-7 text-slate-600">{shortDescription}</p>
          )}
        </div>

        {/* Categories */}

        {(mainCategory || subCategory) && (
          <div className="flex flex-wrap gap-2">
            {mainCategory && (
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <FolderTree size={15} />
                {mainCategory}
              </div>
            )}

            {subCategory && (
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                <Tag size={15} />
                {subCategory}
              </div>
            )}
          </div>
        )}

        {/* Pricing */}

        {pricing && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <BadgeDollarSign size={18} />
              Pricing
            </div>

            {pricing.type === "starting-from" && (
              <div className="text-3xl font-bold text-blue-700">
                {pricing.currency} {pricing.startingPrice}
              </div>
            )}

            {pricing.minimumQuantity && (
              <div className="mt-2 text-sm text-slate-600">
                Minimum Quantity: <strong>{pricing.minimumQuantity}</strong>
              </div>
            )}

            {pricing.quotationRequired && (
              <div className="mt-2 rounded-lg bg-orange-100 px-3 py-2 text-sm font-medium text-orange-700">
                Quotation Required
              </div>
            )}
          </div>
        )}

        {/* Actions */}

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            {actions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
