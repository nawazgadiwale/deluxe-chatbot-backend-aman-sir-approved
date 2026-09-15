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
    let currentMessage = message;

    for (const field of target.fields ?? []) {
      const value = this.resolveField(field, currentMessage);

      if (value != null) {
        extracted[field.id] = value;
        currentMessage = this.consumeMatch(field, currentMessage, value);
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
    const options = (Array.isArray(field.options) ? field.options : []).filter(Boolean);
    if (options.length === 0) return null;

    if (payload && payload.value != null && (!field.id || payload.fieldId === field.id)) {
      const matching = options.find(
        (o) =>
          o &&
          (String(o.value ?? o.id).toLowerCase() ===
            String(payload.value).toLowerCase() ||
          String(o.label ?? o.name).toLowerCase() ===
            String(payload.value).toLowerCase()),
      );
      if (matching) {
        return matching.value !== undefined ? matching.value : matching.id;
      }
    }

    // Fallback for typed text
    const text = this.normalize(message).trim();
    if (!text) return null;

    // 1. Exact value/label match against current catalog options
    const exactOpt = options.find(
      (o) =>
        o &&
        (String(o.value ?? o.id).toLowerCase() === text.toLowerCase() ||
        String(o.label ?? o.name).toLowerCase() === text.toLowerCase()),
    );
    if (exactOpt) {
      return exactOpt.value !== undefined ? exactOpt.value : exactOpt.id;
    }

    // 2. Check numeric and ordinal selection against current options
    const ordinalMap = {
      "1st": 0, "first": 0, "one": 0,
      "2nd": 1, "second": 1, "two": 1,
      "3rd": 2, "third": 2, "three": 2,
      "4th": 3, "fourth": 3, "four": 3,
      "5th": 4, "fifth": 4, "five": 4,
      "6th": 5, "sixth": 5, "six": 5,
      "7th": 6, "seventh": 6, "seven": 6,
      "8th": 7, "eighth": 7, "eight": 7,
      "9th": 8, "ninth": 8, "nine": 8,
      "10th": 9, "tenth": 9, "ten": 9,
    };

    if (ordinalMap[text] !== undefined && options[ordinalMap[text]]) {
      const opt = options[ordinalMap[text]];
      return opt.value !== undefined ? opt.value : (opt.id ?? null);
    }

    const parsedNum = parseInt(text, 10);
    if (!isNaN(parsedNum) && String(parsedNum) === text && parsedNum >= 1 && parsedNum <= options.length) {
      const opt = options[parsedNum - 1];
      return opt.value !== undefined ? opt.value : (opt.id ?? null);
    }

    // 3. Exact or fuzzy text match
    let best = null;
    let bestScore = 0;

    for (const option of options) {
      if (!option) continue;
      const score = Math.max(
        this.score(text, option),
        this.score(message, option),
      );

      if (score > bestScore) {
        best = option;
        bestScore = score;
      }
    }

    return best ? (best.value !== undefined ? best.value : (best.id ?? best.name ?? best.label ?? null)) : null;
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
    const rawList = [
      option.id,
      option.value,
      option.label,
      option.name,
      ...(option.aliases ?? []),
      ...(option.keywords ?? []),
      ...(option.synonyms ?? []),
    ].filter(Boolean);

    const candidates = rawList.map((v) => this.normalize(v));
    const tokenCandidates = [];
    for (const item of rawList) {
      const parts = String(item).split(/[\s-_/]+/);
      for (const p of parts) {
        if (p.length >= 3) {
          tokenCandidates.push(this.normalize(p));
        }
      }
    }

    let score = 0;

    for (const candidate of candidates) {
      if (message === candidate) {
        score += 100;
      } else if (/^\d+$/.test(candidate)) {
        if (new RegExp(`\\b${candidate}\\b`, "i").test(message)) {
          score += 80;
        }
      } else if (candidate.length >= 3 && message.includes(candidate)) {
        score += 80;
      } else if (message.length >= 3 && !/^\d+$/.test(message) && candidate.includes(message)) {
        score += 60;
      }
    }

    for (const token of tokenCandidates) {
      if (message === token) {
        score = Math.max(score, 90);
      } else if (/^\d+$/.test(token)) {
        if (new RegExp(`\\b${token}\\b`, "i").test(message)) {
          score = Math.max(score, 70);
        }
      } else if (message.includes(token)) {
        score = Math.max(score, 70);
      }
    }

    return score;
  }

  consumeMatch(field = {}, message = "", value = null) {
    if (!message || value == null) return message;

    if (
      field.type === "quantity" ||
      field.type === "number" ||
      field.id === "quantity" ||
      field.id === "numberOfNames"
    ) {
      return message.replace(
        new RegExp(`\\b${value}\\s*([a-z]+)?\\b`, "i"),
        " ",
      );
    }

    if (field.type === "select" || !field.type) {
      const option = (field.options ?? []).find(
        (o) => (o.value ?? o.id ?? o.name ?? o.label) === value,
      );
      if (option) {
        const words = [
          option.id,
          option.value,
          option.label,
          option.name,
          ...(option.aliases ?? []),
          ...(option.keywords ?? []),
        ]
          .filter(Boolean)
          .flatMap((s) => String(s).split(/[\s-_/]+/))
          .filter((w) => w.length >= 3);

        let result = message;
        for (const w of words) {
          result = result.replace(new RegExp(`\\b${w}\\b`, "gi"), " ");
        }
        return result;
      }
    }

    return message.replace(new RegExp(`\\b${String(value)}\\b`, "gi"), " ");
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
