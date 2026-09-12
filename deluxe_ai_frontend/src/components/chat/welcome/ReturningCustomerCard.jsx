"use client";

import { motion } from "framer-motion";
import { ArrowRight, Package, RotateCcw, Star } from "lucide-react";

// =====================================================
// RETURNING CUSTOMER CARD
// =====================================================
//
// Shown when:
//   isKnownCustomer === true
//   OR engagement.hasOrdered === true
//
// NOTE on backend data gap:
//   The chat API does NOT return previous order details
//   (product name, quantity, price, variant).
//   engagement.hasOrdered tells us they ordered but
//   not what. Therefore:
//   - We do NOT hardcode any product/order info
//   - [Repeat Last Order] sends a natural language
//     message ("I want to repeat my last order") and
//     lets the AI handle it from conversation history
//
// =====================================================

export default function ReturningCustomerCard({
  customerName = null,
  onRepeatOrder,
  onExploreProducts,
  onRequestQuote,
  onTalkToExpert,
  disabled = false,
}) {
  const firstName = customerName ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-5 text-white">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-400" fill="currentColor" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Returning Customer
          </p>
        </div>

        <h3 className="mt-2 text-lg font-bold">
          {firstName ? `Ready to print again, ${firstName}?` : "Ready to print again?"}
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          You&apos;ve ordered with us before. Let&apos;s make it even easier this time.
        </p>
      </div>

      {/* =====================================================
          REPEAT ORDER SECTION
      ===================================================== */}

      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <Package size={18} className="text-blue-600" />
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">
              Previous order on file
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Our AI can pull up your last order details and help you repeat or modify it.
            </p>
          </div>
        </div>

        {/* Repeat order CTA */}
        <motion.button
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.98 }}
          disabled={disabled}
          onClick={onRepeatOrder}
          className="
            mt-4
            flex
            w-full
            items-center
            justify-center
            gap-2

            rounded-xl

            bg-blue-600

            px-5
            py-3

            text-sm
            font-semibold
            text-white

            shadow-sm

            transition-colors

            hover:bg-blue-700

            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <RotateCcw size={16} />
          Repeat Last Order
        </motion.button>
      </div>

      {/* =====================================================
          SECONDARY ACTIONS
      ===================================================== */}

      <div className="px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Or do something new
        </p>

        <div className="flex flex-col gap-2">
          {/* Explore Products */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            disabled={disabled}
            onClick={onExploreProducts}
            className="
              flex
              items-center
              justify-between

              rounded-xl

              border
              border-slate-200

              bg-slate-50

              px-4
              py-3

              text-sm
              font-medium
              text-slate-700

              transition-colors

              hover:border-slate-300
              hover:bg-slate-100

              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <span>Explore Products</span>
            <ArrowRight size={15} className="text-slate-400" />
          </motion.button>

          {/* Request Quote */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            disabled={disabled}
            onClick={onRequestQuote}
            className="
              flex
              items-center
              justify-between

              rounded-xl

              border
              border-slate-200

              bg-slate-50

              px-4
              py-3

              text-sm
              font-medium
              text-slate-700

              transition-colors

              hover:border-slate-300
              hover:bg-slate-100

              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <span>Request a Quote</span>
            <ArrowRight size={15} className="text-slate-400" />
          </motion.button>

          {/* Talk to Expert */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            disabled={disabled}
            onClick={onTalkToExpert}
            className="
              flex
              items-center
              justify-between

              rounded-xl

              border
              border-slate-200

              bg-slate-50

              px-4
              py-3

              text-sm
              font-medium
              text-slate-700

              transition-colors

              hover:border-slate-300
              hover:bg-slate-100

              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <span>Talk to an Expert</span>
            <ArrowRight size={15} className="text-slate-400" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
