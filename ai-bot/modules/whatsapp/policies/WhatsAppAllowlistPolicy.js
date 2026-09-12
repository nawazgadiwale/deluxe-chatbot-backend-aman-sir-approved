/**
 * WhatsAppAllowlistPolicy.js
 *
 * Canonical Authoritative Phone Allowlist and E.164 Normalizer for WhatsApp Automation.
 *
 * STRICT BUSINESS REQUIREMENT:
 * This AI automation/chatbot is allowed to automatically process, respond to,
 * and send AI-generated replies ONLY to this exact WhatsApp mobile number:
 *
 * Mobile: 8310412768
 * Country: India (+91)
 * E.164: +918310412768
 *
 * All other numbers must be completely excluded and silently ignored.
 * Comparison must strictly be against the normalized E.164 number.
 * No startsWith, endsWith, contains, or fuzzy matching allowed.
 */

export const AUTHORIZED_E164_PHONE = "+918310412768";
export const AUTHORIZED_DIGITS_PHONE = "918310412768";

export default class WhatsAppAllowlistPolicy {
  constructor(options = {}) {
    this.defaultAuthorizedE164 = options.authorizedE164 || AUTHORIZED_E164_PHONE;
  }

  /**
   * Retrieves the canonical authorized E.164 number.
   * Can be configured via environment variable if needed, but defaults strictly to +918310412768.
   */
  getAuthorizedE164() {
    const envVal =
      process.env.WHATSAPP_AUTHORIZED_NUMBER ||
      process.env.WHATSAPP_TEST_SENDER ||
      process.env.WHATSAPP_TEST_ALLOWLIST;

    if (envVal && typeof envVal === "string" && envVal.trim()) {
      const normalized = this.normalizeToE164(envVal);
      if (normalized) {
        return normalized;
      }
    }

    return this.defaultAuthorizedE164;
  }

  /**
   * Reliably normalizes an incoming WhatsApp phone number to standard E.164 format.
   *
   * Handles:
   * - 8310412768 (10 digits, Indian mobile -> +918310412768)
   * - 918310412768 (12 digits, with country code -> +918310412768)
   * - +918310412768 (E.164 -> +918310412768)
   * - 08310412768 (11 digits with trunk prefix 0 -> +918310412768)
   * - 8310412768@c.us or 8310412768@s.whatsapp.net (JID strip -> +918310412768)
   * - International numbers with valid country codes (+1..., etc.)
   *
   * Fails closed (returns null) for missing, malformed, non-numeric, or ambiguous inputs.
   *
   * @param {string|number} rawPhone
   * @returns {string|null} E.164 normalized phone string or null if invalid
   */
  normalizeToE164(rawPhone) {
    if (rawPhone === null || rawPhone === undefined) {
      return null;
    }

    let clean = String(rawPhone).trim();
    if (!clean) {
      return null;
    }

    // Strip WhatsApp JID domain suffixes (@c.us, @s.whatsapp.net, etc.)
    clean = clean.replace(/@.*$/, "").trim();

    const hasLeadingPlus = clean.startsWith("+");
    const digits = clean.replace(/\D/g, "");

    if (!digits) {
      return null;
    }

    // ITU-T E.164 phone numbers must have between 10 and 15 digits
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }

    // --- India Specific Normalization (+91) ---
    // Standard Indian mobile numbers are 10 digits starting with [6-9]
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
      return `+91${digits}`;
    }

    // 11 digits starting with 0 followed by 10-digit Indian mobile
    if (digits.length === 11 && digits.startsWith("0") && /^[6-9]\d{9}$/.test(digits.slice(1))) {
      return `+91${digits.slice(1)}`;
    }

    // 12 digits starting with 91 followed by 10-digit Indian mobile
    if (digits.length === 12 && digits.startsWith("91") && /^[6-9]\d{9}$/.test(digits.slice(2))) {
      return `+${digits}`;
    }

    // 13 digits starting with 910 followed by 10-digit Indian mobile
    if (digits.length === 13 && digits.startsWith("910") && /^[6-9]\d{9}$/.test(digits.slice(3))) {
      return `+91${digits.slice(3)}`;
    }

    // --- General International Numbers ---
    // If the input explicitly had a '+' or if it's an 11-15 digit non-India number
    if (hasLeadingPlus || digits.length >= 11) {
      const candidate = `+${digits}`;
      if (/^\+[1-9]\d{9,14}$/.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Normalizes phone number to digits only with country code (e.g. "918310412768").
   * Used for consistent session ID formatting: whatsapp:<phoneNumberId>:918310412768
   *
   * @param {string|number} rawPhone
   * @returns {string|null}
   */
  normalizeToSessionDigits(rawPhone) {
    const e164 = this.normalizeToE164(rawPhone);
    if (!e164) {
      return null;
    }
    return e164.replace(/\D/g, "");
  }

  /**
   * Authoritative gate check.
   * Compares the normalized sender identity against the single authorized E.164 number.
   *
   * Strict equality only. No partial, prefix, suffix, or substring matches.
   * Fail closed on missing, malformed, or invalid inputs.
   *
   * @param {string|number} rawPhone - Inbound sender phone identity
   * @returns {boolean}
   */
  isAuthorized(rawPhone) {
    if (!rawPhone) {
      return false;
    }

    const normalized = this.normalizeToE164(rawPhone);
    if (!normalized) {
      return false;
    }

    const authorized = this.getAuthorizedE164();

    // STRICT EQUALITY ONLY
    return normalized === authorized;
  }

  /**
   * Masks a phone number for privacy-safe logging without exposing full identity.
   * Example: +918310412768 -> +918***768
   *
   * @param {string|number} rawPhone
   * @returns {string}
   */
  maskPhone(rawPhone) {
    if (!rawPhone) {
      return "[MISSING]";
    }
    const str = String(rawPhone).replace(/@.*$/, "").trim();
    if (str.length <= 6) {
      return "***";
    }
    const prefix = str.slice(0, 4);
    const suffix = str.slice(-3);
    return `${prefix}***${suffix}`;
  }
}
