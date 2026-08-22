"use client";

import SalesCard from "../cards/SalesCard";

export default function SalesRenderer({
  data = {},
  message = "",
  actions = [],
}) {
  console.log("FULL DATA", data);
  console.log("METADATA", data.metadata);
  console.log("ADDONS", data.metadata?.addons);
  console.log("STAGE", data.metadata?.stage);
  return (
    <SalesCard
      message={message}
      requirement={data.liveRequirement}
      metadata={data.metadata}
      decision={data.decision}
      currentStep={data.currentStep}
      actions={actions}
    />
  );
}
