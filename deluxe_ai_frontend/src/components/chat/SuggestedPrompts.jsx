"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { useChatContext } from "../../context/ChatContext";

import { FEATURED_PRODUCTS, QUICK_ACTIONS } from "../../components/quick-actions/FeaturedProducts";

export default function SuggestedPrompts() {
  const { sendMessage, loading } = useChatContext();

  return (
    <div className="space-y-8">
      {/* Header */}

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-2">
          <Sparkles className="text-blue-600" size={18} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Explore More Products
          </h2>

          <p className="text-sm text-slate-500">
            Start another order or ask AI for help.
          </p>
        </div>
      </div>

      {/* Product Suggestions */}

      <div className="grid gap-5 lg:grid-cols-2">
        {FEATURED_PRODUCTS.map((product) => (
          <motion.div
            whileHover={{ y: -4 }}
            key={product.id}
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
              transition
              hover:border-blue-300
              hover:shadow-lg
            "
          >
            <div className="flex">
              {/* Image */}

              <img
                src={product.image}
                alt={product.name}
                className="h-40 w-40 object-cover"
              />

              {/* Content */}

              <div className="flex flex-1 flex-col p-5">
                <div className="inline-flex w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {product.badge}
                </div>

                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  {product.name}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {product.description}
                </p>

                <div className="mt-4 text-lg font-bold text-green-600">
                  {product.price}
                </div>

                <button
                  disabled={loading}
                  onClick={() => sendMessage(product.prompt)}
                  className="
                    mt-auto
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-blue-600
                    py-3
                    font-medium
                    text-white
                    transition
                    hover:bg-blue-700
                  "
                >
                  Order Now
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Divider */}

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />

        <span className="text-sm text-slate-400">OR</span>

        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* AI Actions */}

      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK_ACTIONS.map((item) => {
          const Icon = item.icon;

          return (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={item.title}
              disabled={loading}
              onClick={() => sendMessage(item.prompt)}
              className="
                flex
                items-center
                justify-between
                rounded-2xl
                border
                border-slate-200
                bg-slate-50
                p-5
                text-left
                transition
                hover:border-blue-300
                hover:bg-blue-50
              "
            >
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <Icon className="text-blue-600" size={22} />
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    {item.title}
                  </div>

                  <div className="text-sm text-slate-500">
                    {item.description}
                  </div>
                </div>
              </div>

              <ArrowRight className="text-slate-400" size={18} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
