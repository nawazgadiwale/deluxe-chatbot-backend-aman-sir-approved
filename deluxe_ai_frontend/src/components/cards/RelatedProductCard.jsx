"use client";

import { ArrowRight, Package } from "lucide-react";

import { useChatContext } from "../../context/ChatContext";

export default function RelatedProducts({ title, items = [] }) {
  const { handleAction } = useChatContext();

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>

        <span className="text-sm text-slate-400">{items.length} Products</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() =>
              handleAction({
                id: "SHOW_PRODUCT_DETAILS",
                label: item,
                payload: {
                  product: item,
                  source: "RELATED_PRODUCT",
                },
              })
            }
            className="
              group
              flex
              w-full
              items-center
              justify-between
              rounded-2xl
              border
              border-slate-200
              bg-white
              px-5
              py-4
              transition-all
              duration-200
              hover:border-blue-300
              hover:bg-blue-50
              hover:shadow-md
            "
          >
            <div className="flex items-center gap-4">
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-100
                  text-slate-700
                  group-hover:bg-blue-100
                  group-hover:text-blue-600
                "
              >
                <Package size={20} />
              </div>

              <div className="text-left">
                <div className="font-semibold text-slate-900">{item}</div>
              </div>
            </div>

            <ArrowRight
              size={18}
              className="
                text-slate-400
                transition-transform
                group-hover:translate-x-1
                group-hover:text-blue-600
              "
            />
          </button>
        ))}
      </div>
    </section>
  );
}
