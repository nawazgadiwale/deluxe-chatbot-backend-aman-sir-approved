"use client";

import { Compass } from "lucide-react";

import SummaryCard from "../cards/SummaryCard";
import ProductCard from "../cards/ProductCard";
import ActionButton from "../cards/ActionButton";

export default function DiscoveryRenderer({ data = {}, actions = [] }) {
  const { summary, products = [], followUpQuestion } = data;

  return (
    <div className="space-y-5">
      {/* ==========================================
          Summary
      ========================================== */}

      {summary && (
        <SummaryCard
          title="Product Discovery"
          summary={summary}
          icon={Compass}
        />
      )}

      {/* ==========================================
          Products
      ========================================== */}

      {products.length > 0 && (
        <div className="space-y-5">
          {products.map((product, index) => (
            <ProductCard
              key={product.product ?? product.name ?? index}
              product={product}
            />
          ))}
        </div>
      )}

      {/* ==========================================
          Follow Up
      ========================================== */}

      {followUpQuestion && (
        <div
          className="
            rounded-2xl
            border
            border-blue-100
            bg-blue-50
            p-5
          "
        >
          <div className="font-semibold text-slate-900">Continue Exploring</div>

          <p className="mt-2 text-sm leading-7 text-slate-700">
            {followUpQuestion}
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
