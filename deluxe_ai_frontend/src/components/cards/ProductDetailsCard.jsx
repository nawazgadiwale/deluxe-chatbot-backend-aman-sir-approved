"use client";

import { useMemo, useState } from "react";

import { Sparkles, ImageOff, CheckCircle2 } from "lucide-react";

import ActionButton from "./ActionButton";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ children }) {
  return (
    <div
      className="
      inline-flex items-center gap-2
      rounded-full
      bg-blue-50
      border border-blue-100
      px-3 py-1.5
      text-xs font-semibold
      text-blue-700
    "
    >
      {children}
    </div>
  );
}

function FeatureChip({ children }) {
  return (
    <div
      className="
      flex items-center gap-2
      rounded-xl
      bg-slate-100
      px-3 py-2
      text-xs font-medium
      text-slate-700
    "
    >
      <CheckCircle2 size={14} className="text-emerald-500" />

      {children}
    </div>
  );
}

export default function ProductDetailsCard({ summary, context, actions = [] }) {
  if (!context) return null;

  const product = context.product ?? {};

  const recommendation = context.selection?.recommended ?? {};

  const image = recommendation.image ?? product.image ?? null;

  const gallery = useMemo(() => {
    const imgs = recommendation.images ?? product.images ?? [];

    if (imgs.length) return imgs;

    return image ? [image] : [];
  }, [recommendation, product, image]);

  const [selectedImage, setSelectedImage] = useState(gallery[0] ?? image);

  const price =
    recommendation.startingPrice ?? context.pricing?.startingPrice ?? null;

  const features = recommendation.features ?? context.features ?? [];

  const aiReason =
    summary ??
    recommendation.recommendationReason ??
    "Recommended based on your requirements.";

  return (
    <div
      className="
      max-w-sm
      overflow-hidden
      rounded-3xl
      border border-slate-200
      bg-white
      shadow-lg
    "
    >
      {/* IMAGE */}

      <div className="relative">
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={product.name}
            className="
                h-52
                w-full
                object-cover
              "
          />
        ) : (
          <div
            className="
              flex
              h-52
              items-center
              justify-center
              bg-slate-100
            "
          >
            <ImageOff size={55} className="text-slate-300" />
          </div>
        )}

        <div
          className="
          absolute
          left-4
          top-4
        "
        >
          <Badge>
            <Sparkles size={13} />
            AI Recommended
          </Badge>
        </div>
      </div>

      {/* CONTENT */}

      <div className="space-y-5 p-5">
        <div>
          <h2
            className="
            text-xl
            font-bold
            text-slate-900
          "
          >
            {recommendation.name ?? product.name}
          </h2>

          {price && (
            <div
              className="
                mt-3
                text-2xl
                font-black
                text-green-600
              "
            >
              AED {price}
              <span
                className="
                  ml-2
                  text-xs
                  font-normal
 text-green-600                "
              >
                starting
              </span>
            </div>
          )}

          <p
            className="
            mt-3
            text-sm
            leading-6
            text-slate-600
          "
          >
            {aiReason}
          </p>
        </div>

        {/* FEATURES */}

        {features.length > 0 && (
          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >
            {features.slice(0, 4).map((feature, index) => (
              <FeatureChip key={index}>
                {typeof feature === "string"
                  ? feature
                  : (feature.name ?? feature.label ?? feature.title)}
              </FeatureChip>
            ))}
          </div>
        )}

        {/* QUICK INFO */}

        <div
          className="
          grid
          grid-cols-2
          gap-3
        "
        >
          {product.mainCategory && (
            <div
              className="
                rounded-xl
                bg-slate-50
                p-3
              "
            >
              <p className="text-xs text-slate-400">Category</p>

              <p
                className="
                  mt-1
                  text-sm
                  font-semibold
                "
              >
                {product.mainCategory}
              </p>
            </div>
          )}

          {context.production?.turnaround?.standard && (
            <div
              className="
                rounded-xl
                bg-slate-50
                p-3
              "
            >
              <p className="text-xs text-slate-400">Delivery</p>

              <p
                className="
                  mt-1
                  text-sm
                  font-semibold
                "
              >
                {context.production.turnaround.standard}
              </p>
            </div>
          )}
        </div>

        {/* ACTIONS */}

        {actions.length > 0 && (
          <div
            className="
              space-y-2
              border-t
              border-slate-200
              pt-4
            "
          >
            {actions.slice(0, 3).map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                className="
                      w-full
                      justify-center
                      rounded-xl
                      py-3
                      text-sm
                      font-semibold
                    "
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
