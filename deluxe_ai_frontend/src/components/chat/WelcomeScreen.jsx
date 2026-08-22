"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { useChatContext } from "../../context/ChatContext";

import {
  FEATURED_PRODUCTS,
  QUICK_ACTIONS,
} from "../../components/quick-actions/FeaturedProducts";

export default function WelcomeScreen() {
  const { sendMessage, loading } = useChatContext();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* ================= HEADER ================= */}

      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
          <Sparkles className="text-blue-600" size={36} />
        </div>

        <h1 className="mt-6 text-4xl font-bold text-slate-900">
          Deluxe AI Sales Assistant
        </h1>

        <p className="mt-3 text-lg text-slate-500">
          Choose a product to start your printing order.
        </p>
      </motion.div>

      {/* ================= FEATURED PRODUCTS ================= */}

      {/* ================= FEATURED PRODUCTS ================= */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Featured Products
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select a product to begin your order
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {FEATURED_PRODUCTS.map((product) => (
            <motion.button
              key={product.id}
              whileHover={{
                scale: 1.01,
                y: -2,
              }}
              whileTap={{
                scale: 0.98,
              }}
              disabled={loading}
              onClick={() => sendMessage(product.prompt)}
              className="
          group
          flex
          w-full
          items-center
          gap-4

          rounded-2xl

          border
          border-slate-200

          bg-white

          p-3

          text-left

          shadow-sm

          transition-all

          hover:border-blue-500
          hover:shadow-lg
        "
            >
              {/* Image */}

              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>

              {/* Content */}

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold text-slate-900">
                  {product.name}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Tap to start your order
                </p>
              </div>

              {/* Arrow */}

              <div
                className="
            flex
            h-10
            w-10
            items-center
            justify-center

            rounded-full

            bg-slate-100

            text-slate-500

            transition-all

            group-hover:bg-blue-600
            group-hover:text-white
          "
              >
                <ArrowRight size={18} />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ================= QUICK ACTIONS ================= */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-14"
      >
        <h2 className="mb-6 text-2xl font-bold text-slate-900">
          Quick Actions
        </h2>

        <div className="flex flex-wrap gap-4">
          {QUICK_ACTIONS.map((item) => {
            const Icon = item.icon;

            return (
              <motion.button
                key={item.title}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                onClick={() => {
                  if (item.link) {
                    window.open(item.link, "_blank", "noopener,noreferrer");
                  } else {
                    sendMessage(item.prompt);
                  }
                }}
                className="
                  flex
                  items-center
                  gap-3

                  rounded-full

                  border
                  border-slate-200

                  bg-white

                  px-6
                  py-4

                  font-medium

                  text-slate-700

                  shadow-sm

                  transition-all

                  hover:border-blue-500
                  hover:bg-blue-600
                  hover:text-white
                  hover:shadow-lg
                "
              >
                <Icon size={20} />

                <span>{item.title}</span>

                <ArrowRight size={16} />
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ================= FOOTER ================= */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mt-16 text-center"
      >
        <p className="text-sm text-slate-400">
          Or simply type your printing requirements below to start chatting with
          the AI assistant.
        </p>
      </motion.div>
    </div>
  );
}
