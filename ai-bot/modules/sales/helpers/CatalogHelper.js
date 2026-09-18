/**
 * CatalogHelper.js
 * Centralized catalog helper utilities for image normalization and canonical catalog image resolution.
 */

/**
 * Normalizes and validates an image URL for production WhatsApp messaging.
 * - Deduplicates concatenated duplicate URLs (e.g. "https://...webphttps://...webp")
 * - Handles whitespace, commas, semicolons, and array duplicates
 * - Enforces HTTPS scheme
 * - Rejects unsafe schemes (javascript:, data:, file:)
 * - Rejects localhost, loopback, and private IPv4 ranges
 * - Returns a clean HTTPS URL string or null
 */
export function normalizeImageUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  // Handle arrays containing duplicate or multiple image entries
  let input = rawUrl;
  if (Array.isArray(input)) {
    if (input.length === 0) return null;
    input = input[0];
  }

  if (typeof input !== "string") {
    return null;
  }

  let url = input.trim();
  if (!url) {
    return null;
  }

  // 1. Separate multiple accidental space/comma/semicolon delimited URLs (e.g. "https://a.com/1.webp https://a.com/1.webp")
  if (/[\s,;]/.test(url)) {
    const parts = url.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      url = parts[0];
    }
  }

  // 2. Detect accidental duplicate/concatenated URLs (e.g. "https://a.com/b.webphttps://a.com/b.webp")
  const secondHttp = url.search(/https?:\/\//i, 1);
  if (secondHttp > 0) {
    const part1 = url.slice(0, secondHttp).trim();
    const part2 = url.slice(secondHttp).trim();

    if (part1 === part2 || part2.startsWith(part1) || part1.startsWith(part2)) {
      url = part1;
    } else {
      try {
        new URL(part1);
        url = part1;
      } catch {
        // Fall back to original to let URL validation fail cleanly
      }
    }
  }

  // 3. Detect exact duplicated string halves (e.g. "foo.webpfoo.webp")
  if (url.length % 2 === 0) {
    const half = url.length / 2;
    if (url.slice(0, half) === url.slice(half)) {
      url = url.slice(0, half);
    }
  }

  // 4. Handle relative paths if supported (e.g. /uploads/...)
  if (url.startsWith("/") || url.startsWith("uploads/")) {
    const baseUrl =
      process.env.PUBLIC_URL ||
      process.env.APP_URL ||
      process.env.BASE_URL ||
      null;
    if (baseUrl) {
      try {
        const cleanBase = baseUrl.replace(/\/+$/, "");
        const cleanPath = url.startsWith("/") ? url : `/${url}`;
        url = `${cleanBase}${cleanPath}`;
      } catch {
        return null;
      }
    } else {
      // Cannot invent public URL if no public base is configured
      return null;
    }
  }

  // 5. Validate URL structure and scheme
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return null;
  }

  // 6. Host checks: reject localhost, loopback, private IP ranges
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return null;
  }

  // IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8, 0.0.0.0/8)
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = Number(ipv4Match[1]);
    const o2 = Number(ipv4Match[2]);
    if (
      o1 === 10 ||
      o1 === 127 ||
      o1 === 0 ||
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 169 && o2 === 254)
    ) {
      return null;
    }
  }

  if (!hostname.includes(".")) {
    return null;
  }

  // 7. Prefer HTTPS: if protocol is http:, upgrade to https:
  if (protocol === "http:") {
    parsed.protocol = "https:";
  }

  return parsed.toString();
}

/**
 * Resolves the canonical image URL from a specific catalog object (product, selection option, category, etc.).
 *
 * Rules:
 * 1. Must receive the actual catalog item being rendered.
 * 2. Checks canonical catalog image fields (`image`, `images`, `imageUrl`, `image_url`, `mediaUrl`, `media`, `thumbnail`, `photo`, `picture`).
 * 3. Safely handles strings and arrays.
 * 4. Validates and normalizes URL via normalizeImageUrl.
 * 5. Returns validated HTTPS URL or null.
 * 6. Never invents an image URL.
 * 7. Never falls back to another product's image.
 * 8. Never uses a global or previous workflow image.
 * 9. Never uses an LLM-provided URL.
 *
 * @param {Object} catalogItem
 * @param {Object} [options]
 * @returns {string|null}
 */
export function resolveCatalogImage(catalogItem, options = {}) {
  const productId =
    options?.productId ||
    catalogItem?.id ||
    catalogItem?.productId ||
    catalogItem?.slug ||
    null;
  const catalogPath =
    options?.catalogPath ||
    catalogItem?.catalogPath ||
    "data/sales-catalog";

  if (!catalogItem || typeof catalogItem !== "object") {
    if (productId) {
      console.log(
        `[WhatsApp][CatalogMedia] productId=${productId} imageResolved=false reason=CATALOG_ITEM_MISSING`,
      );
    }
    return null;
  }

  let raw = null;

  if (typeof catalogItem.image === "string" && catalogItem.image.trim()) {
    raw = catalogItem.image;
  } else if (Array.isArray(catalogItem.image) && catalogItem.image.length > 0 && typeof catalogItem.image[0] === "string") {
    raw = catalogItem.image[0];
  } else if (typeof catalogItem.images === "string" && catalogItem.images.trim()) {
    raw = catalogItem.images;
  } else if (Array.isArray(catalogItem.images) && catalogItem.images.length > 0 && typeof catalogItem.images[0] === "string") {
    raw = catalogItem.images[0];
  } else if (typeof catalogItem.imageUrl === "string" && catalogItem.imageUrl.trim()) {
    raw = catalogItem.imageUrl;
  } else if (typeof catalogItem.image_url === "string" && catalogItem.image_url.trim()) {
    raw = catalogItem.image_url;
  } else if (typeof catalogItem.mediaUrl === "string" && catalogItem.mediaUrl.trim()) {
    raw = catalogItem.mediaUrl;
  } else if (typeof catalogItem.media === "string" && catalogItem.media.trim()) {
    raw = catalogItem.media;
  } else if (Array.isArray(catalogItem.media) && catalogItem.media.length > 0 && typeof catalogItem.media[0] === "string") {
    raw = catalogItem.media[0];
  } else if (typeof catalogItem.thumbnail === "string" && catalogItem.thumbnail.trim()) {
    raw = catalogItem.thumbnail;
  } else if (typeof catalogItem.photo === "string" && catalogItem.photo.trim()) {
    raw = catalogItem.photo;
  } else if (typeof catalogItem.picture === "string" && catalogItem.picture.trim()) {
    raw = catalogItem.picture;
  }

  if (!raw) {
    if (productId) {
      console.log(
        `[WhatsApp][CatalogMedia] productId=${productId} imageResolved=false reason=NO_IMAGE_FIELD_IN_CATALOG`,
      );
    }
    return null;
  }

  const normalized = normalizeImageUrl(raw);
  if (!normalized) {
    if (productId) {
      console.log(
        `[WhatsApp][CatalogMedia] productId=${productId} imageResolved=false reason=INVALID_OR_MALICIOUS_URL`,
      );
    }
    return null;
  }

  if (productId) {
    console.log(
      `[WhatsApp][CatalogMedia] productId=${productId} catalogPath=${catalogPath} imageSource=CATALOG imageResolved=true`,
    );
  }

  return normalized;
}

// In-memory cache for validated image URLs (TTL 1 hour)
const mediaValidationCache = new Map();

/**
 * Validates that an image URL is publicly accessible and returns a supported image content-type.
 * Uses a fast HEAD / GET request with a 1500ms timeout and in-memory caching.
 *
 * @param {string} rawUrl
 * @returns {Promise<boolean>}
 */
export async function validateMediaUrl(rawUrl) {
  const normalized = normalizeImageUrl(rawUrl);
  if (!normalized) {
    console.log(`[WhatsApp][Media] rejected reason=INVALID_URL url=${rawUrl}`);
    return false;
  }

  const cached = mediaValidationCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    if (!cached.valid) {
      console.log(`[WhatsApp][Media] rejected reason=${cached.reason || "CACHE_REJECTED"} url=${normalized}`);
    }
    return cached.valid;
  }

  try {
    // 1. Try HEAD request first for minimal bandwidth
    let res = await fetch(normalized, {
      method: "HEAD",
      signal: AbortSignal.timeout(1500),
    }).catch(() => null);

    // If server rejects HEAD (e.g. 405 Method Not Allowed), retry with GET
    if (!res || !res.ok || res.status === 405) {
      res = await fetch(normalized, {
        method: "GET",
        headers: { Range: "bytes=0-1024" },
        signal: AbortSignal.timeout(1500),
      }).catch(() => null);
    }

    if (!res || !res.ok) {
      console.log(`[WhatsApp][Media] rejected reason=NOT_PUBLIC status=${res?.status || "TIMEOUT"} url=${normalized}`);
      mediaValidationCache.set(normalized, { valid: false, reason: "NOT_PUBLIC", timestamp: Date.now() });
      return false;
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    // SVG is not supported by Meta WhatsApp image messages
    if (!contentType.startsWith("image/") || contentType.includes("svg")) {
      console.log(`[WhatsApp][Media] rejected reason=INVALID_CONTENT_TYPE contentType=${contentType} url=${normalized}`);
      mediaValidationCache.set(normalized, { valid: false, reason: "INVALID_CONTENT_TYPE", timestamp: Date.now() });
      return false;
    }

    mediaValidationCache.set(normalized, { valid: true, timestamp: Date.now() });
    return true;
  } catch (err) {
    console.log(`[WhatsApp][Media] rejected reason=PREFLIGHT_ERROR error=${err.message} url=${normalized}`);
    mediaValidationCache.set(normalized, { valid: false, reason: "PREFLIGHT_ERROR", timestamp: Date.now() });
    return false;
  }
}

export default {
  normalizeImageUrl,
  resolveCatalogImage,
  validateMediaUrl,
};

