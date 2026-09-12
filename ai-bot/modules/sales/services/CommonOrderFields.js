/**
 * Application-level order requirements shared by every product.
 * Product-specific fields MUST come from the catalog.
 */
export const COMMON_ORDER_FIELDS = Object.freeze([
  {
    id: "quantity",
    name: "quantity",
    label: "Quantity",
    type: "number",
    required: true,
    min: 1,
    question: "How many pieces do you need?",
    mapsTo: "workflow.quantity",
  },
  {
    id: "artwork",
    name: "artwork",
    label: "Artwork",
    type: "select",
    required: true,
    question: "Do you have print-ready artwork?",
    options: [
      {
        value: "have_artwork",
        label: "I have artwork",
      },
      {
        value: "need_design",
        label: "I need design help",
      },
    ],
    mapsTo: "workflow.artwork",
  },
  {
    id: "deliveryMethod",
    name: "deliveryMethod",
    label: "Delivery Method",
    type: "select",
    required: true,
    question: "Great! How would you like to receive your order?",
    options: [
      {
        value: "pickup",
        label: "Pickup",
        aliases: ["pick up", "collect", "store pickup"],
      },
      {
        value: "delivery",
        label: "Delivery",
        aliases: ["deliver", "deliver it", "ship", "send"],
      },
    ],
    mapsTo: "delivery.method",
  },
  {
    id: "deliveryDate",
    name: "deliveryDate",
    label: "Pickup / Delivery Date",
    type: "date",
    required: true,
    question: "When do you need the order?",
    mapsTo: "delivery.requiredDate",
  },
  {
    id: "deliveryAddress",
    name: "deliveryAddress",
    label: "Complete Delivery Address",
    type: "textarea",
    required: false,
    conditionalRequired: true,
    question:
      "Please enter your complete delivery address so we can deliver your order to the right location",
    mapsTo: "delivery.address",
    conditional: {
      field: "deliveryMethod",
      equals: "delivery",
    },
  },
]);

export default COMMON_ORDER_FIELDS;