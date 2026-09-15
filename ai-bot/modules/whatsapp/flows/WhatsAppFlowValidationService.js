/**
 * WhatsAppFlowValidationService.js
 *
 * Strict Server-Side Validation & Normalization for WhatsApp Flow Submissions.
 *
 * Rules:
 * - Every submitted field must exist in the authoritative product catalog.
 * - Required fields must be present and non-empty.
 * - Value types must match catalog constraints (numbers min/max, dates, email, phone).
 * - Option values for select/multiselect MUST exist in catalog option IDs.
 * - Reject unexpected fields not defined for the product.
 * - Reject unknown option IDs.
 * - Never trust submitted price, productId, or field definitions from client.
 */

import COMMON_ORDER_FIELDS from "../../sales/services/CommonOrderFields.js";

export class FlowValidationError extends Error {
  constructor(message, errors = {}, statusCode = 400) {
    super(message);
    this.name = "FlowValidationError";
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

export default class WhatsAppFlowValidationService {
  /**
   * Strictly validates submitted values against the authoritative catalog product.
   *
   * @param {Object} product - Canonical catalog product definition
   * @param {Object} rawValues - Raw values submitted from WhatsApp Flow
   * @param {Array<Object>} catalogFields - Authoritative fields extracted from product
   * @returns {{ valid: boolean, errors: Object, normalized: Object }}
   */
  validateSubmission(product, rawValues = {}, catalogFields = []) {
    const errors = {};
    const normalized = {
      productId: product?.id || null,
      selections: {},
      requirements: {},
      addons: [],
      customer: {},
    };

    if (!product || typeof product !== "object" || !product.id) {
      errors._general = "Invalid product context for submission validation.";
      return { valid: false, errors, normalized: null };
    }

    if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) {
      errors._general = "Malformed Flow submission payload.";
      return { valid: false, errors, normalized: null };
    }

    // Build lookup map of valid catalog fields
    const validFieldsMap = new Map();
    for (const field of catalogFields) {
      if (field && field.id) {
        validFieldsMap.set(field.id, field);
      }
    }

    // Permit common order fulfillment fields (quantity, artwork, deliveryMethod, etc.)
    if (Array.isArray(COMMON_ORDER_FIELDS)) {
      for (const field of COMMON_ORDER_FIELDS) {
        if (field && field.id && !validFieldsMap.has(field.id)) {
          validFieldsMap.set(field.id, {
            ...field,
            required: false,
          });
        }
      }
    }

    // 1. Check for unexpected fields (client attempting to inject arbitrary data)
    for (const submittedKey of Object.keys(rawValues)) {
      // Allow internal correlation fields if present in top level
      if (["formId", "flowId", "flowToken", "productId", "response_json"].includes(submittedKey)) {
        continue;
      }
      if (!validFieldsMap.has(submittedKey)) {
        errors[submittedKey] = `Field "${submittedKey}" is not recognized for product "${product.id}".`;
      }
    }

    // 2. Validate all declared catalog fields
    for (const [fieldId, fieldDef] of validFieldsMap.entries()) {
      const rawVal = rawValues[fieldId];
      const isPresent = rawVal !== undefined && rawVal !== null && rawVal !== "";
      const isRequired = Boolean(fieldDef.required);

      // Check required
      if (isRequired && !isPresent) {
        errors[fieldId] = `${fieldDef.label || fieldId} is required.`;
        continue;
      }

      if (!isPresent) {
        continue;
      }

      const fieldType = (fieldDef.type || "text").trim().toLowerCase();

      // Validate according to type
      switch (fieldType) {
        case "number": {
          const num = Number(rawVal);
          if (Number.isNaN(num)) {
            errors[fieldId] = `${fieldDef.label} must be a valid number.`;
          } else {
            if (fieldDef.validation?.min != null && num < Number(fieldDef.validation.min)) {
              errors[fieldId] = `${fieldDef.label} must be at least ${fieldDef.validation.min}.`;
            } else if (fieldDef.validation?.max != null && num > Number(fieldDef.validation.max)) {
              errors[fieldId] = `${fieldDef.label} must be at most ${fieldDef.validation.max}.`;
            } else {
              normalized.selections[fieldId] = num;
            }
          }
          break;
        }

        case "email": {
          const emailStr = String(rawVal).trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailStr)) {
            errors[fieldId] = `${fieldDef.label} must be a valid email address.`;
          } else {
            normalized.selections[fieldId] = emailStr;
            normalized.customer.email = emailStr;
          }
          break;
        }

        case "tel":
        case "phone": {
          const phoneStr = String(rawVal).replace(/\D/g, "");
          if (phoneStr.length < 7 || phoneStr.length > 15) {
            errors[fieldId] = `${fieldDef.label} must be a valid phone number.`;
          } else {
            normalized.selections[fieldId] = phoneStr;
            normalized.customer.phone = phoneStr;
          }
          break;
        }

        case "select":
        case "single-select":
        case "radio": {
          const submittedOptId = String(rawVal).trim();
          const allowedOptions = Array.isArray(fieldDef.options)
            ? fieldDef.options.map((opt) => String(opt.id !== undefined && opt.id !== null ? opt.id : opt.value ?? ""))
            : [];

          if (allowedOptions.length > 0 && !allowedOptions.includes(submittedOptId)) {
            errors[fieldId] = `Invalid selection "${submittedOptId}" for ${fieldDef.label}. Must be one of: [${allowedOptions.join(", ")}].`;
          } else {
            normalized.selections[fieldId] = submittedOptId;
          }
          break;
        }

        case "multiple-select":
        case "multiselect": {
          const submittedList = Array.isArray(rawVal) ? rawVal : [rawVal];
          const allowedOptions = Array.isArray(fieldDef.options)
            ? fieldDef.options.map((opt) => String(opt.id !== undefined && opt.id !== null ? opt.id : opt.value ?? ""))
            : [];

          const cleanList = [];
          for (const item of submittedList) {
            const itemStr = String(item).trim();
            if (allowedOptions.length > 0 && !allowedOptions.includes(itemStr)) {
              errors[fieldId] = `Invalid option "${itemStr}" selected for ${fieldDef.label}.`;
            } else {
              cleanList.push(itemStr);
            }
          }

          if (fieldId === "addons") {
            normalized.addons = cleanList;
          } else {
            normalized.selections[fieldId] = cleanList;
          }
          break;
        }

        case "date": {
          const date = new Date(rawVal);
          if (Number.isNaN(date.getTime())) {
            errors[fieldId] = `${fieldDef.label} must be a valid date.`;
          } else {
            normalized.selections[fieldId] = date.toISOString().slice(0, 10);
          }
          break;
        }

        case "text":
        case "textarea":
        default: {
          const textStr = String(rawVal).trim();
          if (fieldDef.validation?.minLength != null && textStr.length < Number(fieldDef.validation.minLength)) {
            errors[fieldId] = `${fieldDef.label} is too short (minimum ${fieldDef.validation.minLength} characters).`;
          } else if (fieldDef.validation?.maxLength != null && textStr.length > Number(fieldDef.validation.maxLength)) {
            errors[fieldId] = `${fieldDef.label} is too long (maximum ${fieldDef.validation.maxLength} characters).`;
          } else {
            normalized.selections[fieldId] = textStr;
          }
          break;
        }
      }
    }

    const isValid = Object.keys(errors).length === 0;

    return {
      valid: isValid,
      errors,
      normalized: isValid ? normalized : null,
    };
  }
}
