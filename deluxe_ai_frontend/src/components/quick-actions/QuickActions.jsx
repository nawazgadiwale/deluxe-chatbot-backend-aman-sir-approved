"use client";

import ActionButton from "../cards/ActionButton";

const actions = [
  {
    id: "RECOMMEND_PRODUCTS",
    label: "Recommend Products",
  },
  {
    id: "CONTACT_SALES",
    label: "Talk to an Expert",
  },
  {
    id: "SEND_PROFILE",
    label: "Company Profile",
  },
  {
    id: "CONTACT_SUPPORT",
    label: "Contact Support",
  },
];

export default function QuickActions() {
  return (
    <div
      className="
        flex
        flex-wrap
        gap-3
        px-5
        py-4
        bg-white
      "
    >
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}
