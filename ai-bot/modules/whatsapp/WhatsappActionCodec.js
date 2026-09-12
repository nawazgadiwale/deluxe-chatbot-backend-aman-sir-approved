export default class WhatsappActionCodec {
  static encode(action = {}) {
    if (!action) return "";

    const actionId = action.id || action.type;
    const payload = action.payload ?? {};

    // Compact semantic IDs for common catalog actions
    if (
      (actionId === "SELECT_NESTED_PRODUCT" || action.type === "SELECT_NESTED_PRODUCT") &&
      payload.productId &&
      payload.selectionId &&
      payload.nestedProductId
    ) {
      return `nested:${payload.productId}:${payload.selectionId}:${payload.nestedProductId}`.slice(0, 256);
    }

    if (
      (actionId === "SELECT_SELECTION" || action.type === "SELECT_SELECTION") &&
      payload.productId &&
      payload.selectionId
    ) {
      return `selection:${payload.productId}:${payload.selectionId}`.slice(0, 256);
    }

    if (
      (actionId === "SELECT_PRODUCT" || action.type === "SELECT_PRODUCT") &&
      payload.productId
    ) {
      return `product:${payload.productId}`.slice(0, 256);
    }

    // Compact order now pattern: order_now:<productId>:<formId>
    if (
      (actionId === "ORDER_NOW" || action.type === "ORDER_NOW") &&
      payload.productId
    ) {
      return `order_now:${payload.productId}:${payload.formId || ""}`.slice(0, 256);
    }

    // Compact generic actions: SET_FIELD|fieldId|value
    if ((actionId === "SET_FIELD" || action.type === "SET_FIELD") && payload.fieldId && payload.value != null) {
      return `SET_FIELD|${payload.fieldId}|${payload.value}`.slice(0, 256);
    }

    // Compact generic requirement: SET_REQUIREMENT|requirementId|value
    if ((actionId === "SET_REQUIREMENT" || action.type === "SET_REQUIREMENT") && payload.requirementId && payload.value != null) {
      return `SET_REQUIREMENT|${payload.requirementId}|${payload.value}`.slice(0, 256);
    }

    // Compact generic addon: TOGGLE_ADDON|addonId
    if ((actionId === "TOGGLE_ADDON" || action.type === "TOGGLE_ADDON") && payload.addonId) {
      return `TOGGLE_ADDON|${payload.addonId}`.slice(0, 256);
    }

    // Compact generic delivery: SET_DELIVERY|method
    if ((actionId === "SET_DELIVERY" || action.type === "SET_DELIVERY") && (payload.method || payload.value)) {
      return `SET_DELIVERY|${payload.method || payload.value}`.slice(0, 256);
    }

    // Compact customer field: SET_CUSTOMER_FIELD|fieldId|value
    if (
      (actionId === "SET_CUSTOMER_FIELD" || action.type === "SET_CUSTOMER_FIELD") &&
      payload.fieldId &&
      payload.value != null
    ) {
      return `SET_CUSTOMER_FIELD|${payload.fieldId}|${payload.value}`.slice(0, 256);
    }

    // Compact form field action pattern: form_field:<formId>:<fieldId>:<value>
    if (
      (actionId === "SET_FORM_FIELD" || actionId === "FORM_FIELD_VALUE") &&
      payload.fieldId &&
      payload.value != null
    ) {
      return `form_field:${payload.formId || ""}:${payload.fieldId}:${payload.value}`.slice(0, 256);
    }

    // Compact generic control actions without special payload
    const payloadKeys = Object.keys(payload);
    if (
      [
        "ORDER_NOW",
        "NEXT_STEP",
        "BACK",
        "EDIT_ORDER",
        "CONFIRM_ORDER",
        "CANCEL_ORDER",
      ].includes(actionId) &&
      (payloadKeys.length === 0 ||
        payloadKeys.every(
          (k) =>
            payload[k] === true ||
            payload[k] === false ||
            payload[k] == null,
        ))
    ) {
      return actionId;
    }

    const fullPayload = {
      id: actionId,
      type: action.type || actionId,
      payload,
    };

    const encoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const value = `a:${encoded}`;

    // WhatsApp interactive reply IDs have a 256-character limit.
    if (value.length <= 256) return value;

    return String(actionId || "").slice(0, 256);
  }

  static decode(value = "") {
    if (!value) return null;

    if (typeof value === "object") {
      if (value.id || value.type) {
        return {
          id: value.id || value.type,
          type: value.type || value.id,
          payload: value.payload ?? {},
        };
      }
      return null;
    }

    let text = String(value || "").trim();
    if (!text) return null;

    // Strip common interactive wrapper prefixes (e.g., "ButtonsV3:", "ButtonsV2:", "Buttons:", "Button:", "quick_reply:", "meta:")
    for (const prefix of [
      "SET_FIELD|",
      "SET_REQUIREMENT|",
      "TOGGLE_ADDON|",
      "SET_DELIVERY|",
      "SET_CUSTOMER_FIELD|",
      "order_now:",
      "form_field:",
      "nested:",
      "selection:",
      "product:",
      "a:",
    ]) {
      const idx = text.indexOf(prefix);
      if (idx !== -1) {
        text = text.slice(idx);
        break;
      }
    }

    if (text.startsWith("SET_FIELD|")) {
      const parts = text.split("|");
      if (parts.length >= 3) {
        return {
          id: "SET_FIELD",
          type: "SET_FIELD",
          payload: {
            fieldId: parts[1],
            value: parts.slice(2).join("|"),
          },
        };
      }
    }

    if (text.startsWith("SET_REQUIREMENT|")) {
      const parts = text.split("|");
      if (parts.length >= 3) {
        return {
          id: "SET_REQUIREMENT",
          type: "SET_REQUIREMENT",
          payload: {
            requirementId: parts[1],
            value: parts.slice(2).join("|"),
          },
        };
      }
    }

    if (text.startsWith("TOGGLE_ADDON|")) {
      const parts = text.split("|");
      if (parts.length >= 2) {
        return {
          id: "TOGGLE_ADDON",
          type: "TOGGLE_ADDON",
          payload: {
            addonId: parts.slice(1).join("|"),
          },
        };
      }
    }

    if (text.startsWith("SET_DELIVERY|")) {
      const parts = text.split("|");
      if (parts.length >= 2) {
        return {
          id: "SET_DELIVERY",
          type: "SET_DELIVERY",
          payload: {
            method: parts.slice(1).join("|"),
            value: parts.slice(1).join("|"),
          },
        };
      }
    }

    if (text.startsWith("SET_CUSTOMER_FIELD|")) {
      const parts = text.split("|");
      if (parts.length >= 3) {
        return {
          id: "SET_CUSTOMER_FIELD",
          type: "SET_CUSTOMER_FIELD",
          payload: {
            fieldId: parts[1],
            value: parts.slice(2).join("|"),
          },
        };
      }
    }

    // 1. Compact order now pattern: order_now:<productId>:<formId>
    if (text.startsWith("order_now:")) {
      const parts = text.split(":");
      if (parts.length >= 2) {
        return {
          id: "ORDER_NOW",
          type: "ORDER_NOW",
          payload: {
            productId: parts[1],
            formId: parts.slice(2).join(":") || null,
          },
        };
      }
    }

    // 2. Compact form field pattern: form_field:<formId>:<fieldId>:<value>
    if (text.startsWith("form_field:")) {
      const parts = text.split(":");
      if (parts.length >= 4) {
        return {
          id: "SET_FORM_FIELD",
          type: "SET_FORM_FIELD",
          payload: {
            formId: parts[1] || null,
            fieldId: parts[2],
            value: parts.slice(3).join(":"),
          },
        };
      }
    }

    // 2. Compact nested product pattern: nested:<productId>:<selectionId>:<nestedProductId>
    if (text.startsWith("nested:")) {
      const parts = text.split(":");
      if (parts.length >= 4) {
        return {
          id: "SELECT_NESTED_PRODUCT",
          type: "SELECT_NESTED_PRODUCT",
          payload: {
            productId: parts[1],
            selectionId: parts[2],
            nestedProductId: parts.slice(3).join(":"),
          },
        };
      }
    }

    // 3. Compact selection pattern: selection:<productId>:<selectionId>
    if (text.startsWith("selection:")) {
      const parts = text.split(":");
      if (parts.length >= 3) {
        return {
          id: "SELECT_SELECTION",
          type: "SELECT_SELECTION",
          payload: {
            productId: parts[1],
            selectionId: parts.slice(2).join(":"),
          },
        };
      }
    }

    // 4. Compact product pattern: product:<productId>
    if (text.startsWith("product:")) {
      const parts = text.split(":");
      if (parts.length >= 2) {
        return {
          id: "SELECT_PRODUCT",
          type: "SELECT_PRODUCT",
          payload: {
            productId: parts.slice(1).join(":"),
          },
        };
      }
    }

    // 4. Base64url encoded action pattern: a:<base64url>
    if (text.startsWith("a:")) {
      try {
        const decoded = JSON.parse(
          Buffer.from(text.slice(2), "base64url").toString("utf8"),
        );

        if (!decoded?.id && !decoded?.type) return null;
        return {
          id: decoded.id || decoded.type,
          type: decoded.type || decoded.id,
          payload: decoded.payload ?? {},
        };
      } catch {
        return null;
      }
    }

    // 5. Direct standard action identifiers (e.g., "SELECT_SELECTION", "SUBMIT_ORDER_FORM", "START_ORDER")
    if (/^[A-Z0-9_]+$/.test(text)) {
      return {
        id: text,
        type: text,
        payload: {},
      };
    }

    return null;
  }
}
