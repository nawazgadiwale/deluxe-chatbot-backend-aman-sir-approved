export default class WhatsappActionCodec {
  static encode(action = {}) {
    if (!action) return "";

    const actionId = action.id || action.type;
    const payload = action.payload ?? {};

    // Pipe-delimited compact encoding for conversational ordering
    if (actionId === "SET_FIELD" && payload.fieldId && payload.value != null) {
      return `SET_FIELD|${payload.fieldId}|${payload.value}`.slice(0, 256);
    }

    if (actionId === "SET_REQUIREMENT" && payload.requirementId && payload.value != null) {
      return `SET_REQUIREMENT|${payload.requirementId}|${payload.value}`.slice(0, 256);
    }

    if (actionId === "TOGGLE_ADDON" && payload.addonId) {
      return `TOGGLE_ADDON|${payload.addonId}`.slice(0, 256);
    }

    if (actionId === "SET_DELIVERY" && payload.method) {
      return `SET_DELIVERY|${payload.method}`.slice(0, 256);
    }

    if (actionId === "SET_CUSTOMER_FIELD" && payload.fieldId && payload.value != null) {
      return `SET_CUSTOMER_FIELD|${payload.fieldId}|${payload.value}`.slice(0, 256);
    }

    // Control actions without payload (or empty payload)
    const controlActions = new Set([
      "ORDER_NOW",
      "NEXT_STEP",
      "BACK",
      "EDIT_ORDER",
      "CONFIRM_ORDER",
      "CANCEL_ORDER",
      "SUBMIT_ORDER_FORM",
      "START_ORDER",
    ]);
    if (controlActions.has(actionId) && (!payload || Object.keys(payload).length === 0)) {
      return actionId;
    }

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

    // Compact order now pattern: order_now:<productId>:<selectionId>
    if (
      (actionId === "ORDER_NOW" || action.type === "ORDER_NOW") &&
      payload.productId
    ) {
      return `order_now:${payload.productId}:${payload.selectionId || payload.formId || ""}`.slice(0, 256);
    }

    // Compact form field action pattern: form_field:<formId>:<fieldId>:<value>
    if (
      (actionId === "SET_FORM_FIELD" || actionId === "FORM_FIELD_VALUE") &&
      payload.fieldId &&
      payload.value != null
    ) {
      return `form_field:${payload.formId || ""}:${payload.fieldId}:${payload.value}`.slice(0, 256);
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

    // Check pipe-delimited pattern (strip prefix if any)
    const pipeIdx = text.indexOf("|");
    if (pipeIdx !== -1) {
      const colonIdx = text.lastIndexOf(":", pipeIdx);
      const cleanText = colonIdx !== -1 ? text.slice(colonIdx + 1) : text;
      const parts = cleanText.split("|");
      const id = parts[0];
      if (id === "SET_FIELD" && parts.length >= 3) {
        return {
          id: "SET_FIELD",
          type: "SET_FIELD",
          payload: {
            fieldId: parts[1],
            value: parts.slice(2).join("|"),
          },
        };
      }
      if (id === "SET_REQUIREMENT" && parts.length >= 3) {
        return {
          id: "SET_REQUIREMENT",
          type: "SET_REQUIREMENT",
          payload: {
            requirementId: parts[1],
            value: parts.slice(2).join("|"),
          },
        };
      }
      if (id === "TOGGLE_ADDON" && parts.length >= 2) {
        return {
          id: "TOGGLE_ADDON",
          type: "TOGGLE_ADDON",
          payload: {
            addonId: parts.slice(1).join("|"),
          },
        };
      }
      if (id === "SET_DELIVERY" && parts.length >= 2) {
        return {
          id: "SET_DELIVERY",
          type: "SET_DELIVERY",
          payload: {
            method: parts.slice(1).join("|"),
          },
        };
      }
      if (id === "SET_CUSTOMER_FIELD" && parts.length >= 3) {
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

    // Strip common provider/transport wrapper prefixes (e.g., "ButtonsV3:", "ButtonsV2:", "Buttons:", "Button:", "quick_reply:", "whapi:", "meta:")
    const orderNowIdx = text.indexOf("order_now:");
    if (orderNowIdx !== -1) {
      text = text.slice(orderNowIdx);
    } else {
      const formFieldIdx = text.indexOf("form_field:");
      if (formFieldIdx !== -1) {
        text = text.slice(formFieldIdx);
      } else {
        const nestedIdx = text.indexOf("nested:");
        if (nestedIdx !== -1) {
          text = text.slice(nestedIdx);
        } else {
          const selectionIdx = text.indexOf("selection:");
          if (selectionIdx !== -1) {
            text = text.slice(selectionIdx);
          } else {
            const productIdx = text.indexOf("product:");
            if (productIdx !== -1) {
              text = text.slice(productIdx);
            } else {
              const aIdx = text.indexOf("a:");
              if (aIdx !== -1) {
                text = text.slice(aIdx);
              }
            }
          }
        }
      }
    }

    // 1. Compact order now pattern: order_now:<productId>:<selectionId>
    if (text.startsWith("order_now:")) {
      const parts = text.split(":");
      if (parts.length >= 2) {
        const secondary = parts.slice(2).join(":") || null;
        return {
          id: "ORDER_NOW",
          type: "ORDER_NOW",
          payload: {
            productId: parts[1],
            selectionId: secondary,
            formId: secondary,
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
