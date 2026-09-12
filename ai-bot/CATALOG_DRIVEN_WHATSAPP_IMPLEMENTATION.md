# Catalog-Driven WhatsApp Sales Implementation

This update implements the supplied Deluxe Printing WhatsApp sales specification.

## Implemented

- Catalog remains the source for product/category/variant/product-field definitions.
- Product matching no longer silently selects the first result when multiple products match.
- Natural-language matching supports common singular/plural and alias forms such as `cards` -> `Business Cards`.
- Category requests resolve to products in that category.
- Unknown products return browse/expert choices instead of inventing an item.
- Common order requirements are enforced for every order:
  - quantity
  - artwork status
  - pickup/delivery method
  - pickup/delivery date
  - delivery address when delivery is selected
- Product-specific fields remain catalog-driven.
- Conditional validation is supported.
- Catalog `confirmation` fields normalize to selectable fields.
- Unknown form keys are ignored rather than persisted.
- Delivery fees are no longer invented; only explicit backend/catalog charges are used.
- Artwork media received through WhatsApp can be attached to the active order.
- Order form submission does not finalize the order.
- Customer details are collected separately through the lead flow.
- A review step is produced with Confirm / Edit / Talk to Expert actions.
- Final order confirmation generates the order number and changes the order to `CONFIRMED`.
- WhatsApp button/list actions now carry their payload safely instead of losing `productId`, `selectionId`, etc.
- More than three WhatsApp choices use a list instead of trying to squeeze all choices into buttons.
- Order-flow payloads include the catalog-driven field metadata and current values for a generic WhatsApp Flow screen.

## Important WhatsApp Flow requirement

The backend now sends `form_fields` and `form_values` in the Order Flow payload. The configured Meta WhatsApp Flow must actually consume those values. A static Flow screen cannot magically create arbitrary input components for an unlimited set of catalog fields. The Flow configuration/data-exchange layer must therefore map the supplied field metadata to the supported WhatsApp Flow components.

The backend remains catalog-driven; the WhatsApp Flow UI is a separate Meta configuration concern.

## Verification

Run:

```bash
node tests/catalog-driven-sales.test.js
```

The test covers catalog discovery, category discovery, ambiguity protection, dynamic common/product fields, conditional delivery validation, field selection extraction, and WhatsApp action payload encoding.

All JavaScript files in the supplied project were syntax-checked with `node --check`.
