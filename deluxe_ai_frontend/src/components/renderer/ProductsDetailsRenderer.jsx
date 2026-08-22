"use client";

import ProductDetailsCard from "../cards/ProductDetailsCard";
import ActionButton from "../cards/ActionButton";

export default function ProductDetailsRenderer({ data = {}, actions = [] }) {
  const context = data.context;

  if (!context) return null;

  const responseActions = actions.length > 0 ? actions : (data.actions ?? []);

  return (
    <div className="space-y-5">
      <ProductDetailsCard
        summary={data.summary}
        context={context}
        actions={responseActions}
      />

      
    </div>
  );
}
