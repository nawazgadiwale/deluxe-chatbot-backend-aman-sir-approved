"use client";

import { motion } from "framer-motion";
import { Sparkles, MessageCircle } from "lucide-react";

import SummaryCard from "../cards/SummaryCard";
import ProductCard from "../cards/ProductCard";
import ActionButton from "../cards/ActionButton";

export default function RecommendationRenderer({ data = {}, actions = [] }) {
  const { summary, products = [], followUpQuestion } = data;

  return (
    <div className="space-y-5">
      {/* ==========================================
          AI Summary
      ========================================== */}

      {summary && (
        <SummaryCard
          title="AI Recommendation"
          summary={summary}
          icon={Sparkles}
        />
      )}

      {/* ==========================================
          Recommended Products
      ========================================== */}

      {products.length > 0 && (
        <div className="space-y-5">
          {products.map((product, index) => (
            <motion.div
              key={product.product ?? index}
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.08,
              }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      )}

      {/* ==========================================
          Global Actions
      ========================================== */}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}

      {/* ==========================================
          Follow Up
      ========================================== */}

      {followUpQuestion && (
        <div
          className="
            flex
            items-start
            gap-3

            rounded-2xl

            border
            border-blue-100

            bg-blue-50

            p-5
          "
        >
          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center

              rounded-xl

              bg-blue-600

              text-white
            "
          >
            <MessageCircle size={18} />
          </div>

          <div>
            <div className="font-semibold text-slate-900">Next Step</div>

            <p className="mt-1 text-sm leading-7 text-slate-600">
              {followUpQuestion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
