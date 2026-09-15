/**
 * WhatsAppFlowFieldMapper.js
 *
 * Centralized catalog field-type to native WhatsApp Flow component mapper.
 *
 * Enforces contract integrity:
 * - Preserves catalog field IDs as component names.
 * - Maps supported catalog types to official WhatsApp Flow components.
 * - Preserves catalog option IDs as selectable option IDs.
 * - Throws controlled UnsupportedFieldTypeError for unknown or unsupported field types.
 * - Zero silent conversions to arbitrary types.
 */

export class UnsupportedFieldTypeError extends Error {
  constructor(fieldId, fieldType, availableTypes = []) {
    super(
      `Unsupported catalog field type "${fieldType}" for field "${fieldId}". Supported types: ${availableTypes.join(", ")}`,
    );
    this.name = "UnsupportedFieldTypeError";
    this.fieldId = fieldId;
    this.fieldType = fieldType;
    this.statusCode = 400;
  }
}

export const SUPPORTED_CATALOG_TYPES = [
  "text",
  "tel",
  "phone",
  "email",
  "number",
  "select",
  "single-select",
  "radio",
  "multiple-select",
  "multiselect",
  "textarea",
  "date",
];

export default class WhatsAppFlowFieldMapper {
  /**
   * Check whether a catalog field type is supported.
   * @param {string} fieldType
   * @returns {boolean}
   */
  static isSupported(fieldType) {
    if (!fieldType || typeof fieldType !== "string") return false;
    return SUPPORTED_CATALOG_TYPES.includes(fieldType.trim().toLowerCase());
  }

  /**
   * Map catalog option objects to WhatsApp Flow data source items.
   * Preserves catalog option.id as the contract value.
   *
   * @param {Array<Object>} options - Catalog field options
   * @returns {Array<{ id: string, title: string, description?: string }>}
   */
  static mapOptions(options = []) {
    if (!Array.isArray(options)) return [];

    return options.map((opt) => {
      const id = String(
        opt.id !== undefined && opt.id !== null ? opt.id : opt.value ?? "",
      );
      const title = String(
        opt.label || opt.name || opt.title || opt.id || opt.value || "",
      ).trim();

      const item = {
        id,
        title: title.slice(0, 50),
      };

      if (opt.description || opt.desc || opt.printArea || opt.weight) {
        const desc =
          opt.description ||
          opt.desc ||
          (opt.printArea ? `Area: ${opt.printArea}` : null) ||
          (opt.weight ? `Weight: ${opt.weight}` : null);
        if (desc) {
          item.description = String(desc).slice(0, 80);
        }
      }

      return item;
    });
  }

  /**
   * Maps a single catalog field definition into a native WhatsApp Flow component specification.
   *
   * @param {Object} field - Catalog field definition
   * @returns {Object} WhatsApp Flow component definition
   * @throws {UnsupportedFieldTypeError} if field type is not supported
   */
  static mapFieldToComponent(field = {}) {
    if (!field || typeof field !== "object") {
      throw new Error("Invalid field definition provided to WhatsAppFlowFieldMapper.");
    }

    const fieldId = field.id || field.name;
    if (!fieldId) {
      throw new Error("Catalog field must have a stable identifier (id).");
    }

    const rawType = (field.type || "text").trim().toLowerCase();

    if (!this.isSupported(rawType)) {
      throw new UnsupportedFieldTypeError(fieldId, rawType, SUPPORTED_CATALOG_TYPES);
    }

    const label = String(field.label || field.title || fieldId).trim();
    const isRequired = Boolean(field.required ?? false);
    const helperText = field.helperText || field.description || field.question || null;

    switch (rawType) {
      case "text":
        return {
          type: "TextInput",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "input-type": "text",
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
          ...(field.validation?.minLength ? { "min-chars": Number(field.validation.minLength) } : {}),
          ...(field.validation?.maxLength ? { "max-chars": Number(field.validation.maxLength) } : {}),
        };

      case "tel":
      case "phone":
        return {
          type: "TextInput",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "input-type": "phone",
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
        };

      case "email":
        return {
          type: "TextInput",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "input-type": "email",
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
        };

      case "number":
        return {
          type: "TextInput",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "input-type": "number",
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
          ...(field.validation?.min != null ? { "min-chars": 1 } : {}),
        };

      case "textarea":
        return {
          type: "TextArea",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
          ...(field.validation?.maxLength ? { "max-length": Number(field.validation.maxLength) } : {}),
        };

      case "select":
      case "single-select": {
        const options = this.mapOptions(field.options || []);
        // For 3 or fewer options, RadioButtonsGroup gives a superior mobile UX, else Dropdown
        if (options.length > 0 && options.length <= 3 && field.displayAsRadio) {
          return {
            type: "RadioButtonsGroup",
            name: fieldId,
            label: label.slice(0, 40),
            required: isRequired,
            "data-source": options,
            ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
          };
        }
        return {
          type: "Dropdown",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "data-source": options,
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
        };
      }

      case "radio": {
        const options = this.mapOptions(field.options || []);
        return {
          type: "RadioButtonsGroup",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "data-source": options,
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
        };
      }

      case "multiple-select":
      case "multiselect": {
        const options = this.mapOptions(field.options || []);
        return {
          type: "CheckboxGroup",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          "data-source": options,
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
        };
      }

      case "date":
        return {
          type: "DatePicker",
          name: fieldId,
          label: label.slice(0, 40),
          required: isRequired,
          ...(helperText ? { "helper-text": String(helperText).slice(0, 80) } : {}),
        };

      default:
        throw new UnsupportedFieldTypeError(fieldId, rawType, SUPPORTED_CATALOG_TYPES);
    }
  }
}
