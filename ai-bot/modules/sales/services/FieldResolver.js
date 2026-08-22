export default class FieldResolver {
  resolve(target = {}, message = "") {
    if (!target || !message.trim()) {
      return {};
    }

    // Single field
    if (target.id && target.type) {
      const value = this.resolveField(target, message);

      return value == null
        ? {}
        : {
            [target.id]: value,
          };
    }

    // Product / Variant
    const extracted = {};

    for (const field of target.fields ?? []) {
      const value = this.resolveField(field, message);

      if (value != null) {
        extracted[field.id] = value;
      }
    }

    return extracted;
  }

  resolveField(field = {}, message = "") {
    const resolver = this[`resolve${this.capitalize(field.type)}`];

    if (typeof resolver !== "function") {
      return null;
    }

    return resolver.call(this, field, message);
  }

  /* ---------------- SELECT ---------------- */

  resolveSelect(field = {}, message = "", payload = null) {
    if (
      payload?.fieldId === field.id &&
      field.options?.some((o) => o.id === payload.value)
    ) {
      return payload.value;
    }

    // Fallback for typed text
    const text = this.normalize(message);

    let best = null;
    let bestScore = 0;

    for (const option of field.options ?? []) {
      const score = this.score(text, option);

      if (score > bestScore) {
        best = option;
        bestScore = score;
      }
    }

    return best?.id ?? null;
  }

  /* ---------------- MULTI SELECT ---------------- */

  resolveMultiselect(field = {}, message = "") {
    const text = this.normalize(message);

    return (field.options ?? [])
      .filter((option) => this.score(text, option) > 0)
      .map(
        (option) => option.value ?? option.id ?? option.name ?? option.label,
      );
  }

  /* ---------------- NUMBER ---------------- */

  resolveNumber(field, message) {
    const match = message.match(/-?\d+(\.\d+)?/);

    if (!match) {
      return null;
    }

    return Number(match[0]);
  }

  /* ---------------- QUANTITY ---------------- */

  resolveQuantity(field, message) {
    return this.resolveNumber(field, message);
  }

  /* ---------------- BOOLEAN ---------------- */

  resolveBoolean(field, message) {
    const text = this.normalize(message);

    const truthy = [
      "yes",
      "yeah",
      "yep",
      "true",
      "correct",
      "sure",
      "ok",
      "okay",
      "have",
      "ready",
      "available",
    ];

    const falsy = [
      "no",
      "nope",
      "false",
      "dont",
      "donot",
      "not",
      "none",
      "skip",
    ];

    if (truthy.some((v) => text.includes(v))) {
      return true;
    }

    if (falsy.some((v) => text.includes(v))) {
      return false;
    }

    return null;
  }

  resolveConfirmation(field, message) {
    return this.resolveBoolean(field, message);
  }

  /* ---------------- TEXT ---------------- */

  resolveText(field, message) {
    const text = message.trim();

    return text.length ? text : null;
  }

  resolveTextarea(field, message) {
    return this.resolveText(field, message);
  }

  /* ---------------- EMAIL ---------------- */

  resolveEmail(field, message) {
    const match = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

    return match ? match[0] : null;
  }

  /* ---------------- PHONE ---------------- */

  resolvePhone(field, message) {
    const digits = message.replace(/\D/g, "");

    return digits.length >= 7 ? digits : null;
  }

  /* ---------------- DATE ---------------- */

  resolveDate(field, message) {
    return message.trim() || null;
  }

  /* ---------------- TIME ---------------- */

  resolveTime(field, message) {
    return message.trim() || null;
  }

  /* ---------------- DIMENSIONS ---------------- */

  resolveDimensions(field, message) {
    const normalized = this.normalize(message);

    const match = normalized.match(
      /(\d+(\.\d+)?)(cm|mm|m|ft|in)?x(\d+(\.\d+)?)(cm|mm|m|ft|in)?/,
    );

    if (!match) {
      return null;
    }

    return match[0];
  }

  /* ---------------- FILE ---------------- */

  resolveFile(field, message) {
    const text = this.normalize(message);

    if (text.includes("upload")) return "upload";
    if (text.includes("pdf")) return "pdf";
    if (text.includes("ai")) return "ai";
    if (text.includes("design")) return "design-required";
    if (text.includes("later")) return "later";

    return null;
  }

  /* ---------------- HELPERS ---------------- */

  getMissing(target = {}, values = {}) {
    return (target.fields ?? []).filter((field) => {
      if (field.required === false) {
        return false;
      }

      return (
        values[field.id] === undefined ||
        values[field.id] === null ||
        values[field.id] === ""
      );
    });
  }

  isCompleted(target = {}, values = {}) {
    return this.getMissing(target, values).length === 0;
  }

  score(message, option = {}) {
    const candidates = [
      option.id,
      option.value,
      option.label,
      option.name,
      ...(option.aliases ?? []),
      ...(option.keywords ?? []),
      ...(option.synonyms ?? []),
    ]
      .filter(Boolean)
      .map((v) => this.normalize(v));

    let score = 0;

    for (const candidate of candidates) {
      if (message === candidate) {
        score += 100;
      } else if (message.includes(candidate)) {
        score += 80;
      } else if (candidate.includes(message)) {
        score += 60;
      }
    }

    return score;
  }

  normalize(value = "") {
    return String(value)
      .toLowerCase()
      .replace(/×/g, "x")
      .replace(/[-_/]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9.]/g, "");
  }

  capitalize(value = "") {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}
