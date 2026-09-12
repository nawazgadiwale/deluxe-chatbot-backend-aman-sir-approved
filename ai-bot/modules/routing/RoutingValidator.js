const VALID_CAPABILITIES = new Set([
  "greeting",
  "sales",
  "product_details",
  "faq",
  "support",
  "out_of_scope",
  "discovery",
  "lead",
  "resume_workflow",
  "cancel_workflow",
]);

const VALID_SOURCES = new Set([
  "ACTION",
  "RULE",
  "LLM",
  "LLM_PRODUCT",
  "WORKFLOW",
  "CONVERSATION",
  "RESUME",
  "FALLBACK",
]);

const VALID_REQUEST_TYPES = new Set([
  "ORDER",
  "QUOTATION",
  "EXPERT",
  "CONTACT_SALES",
]);

export default class RoutingValidator {
  validate(result = {}) {
    const capability = this.validateCapability(result.capability);

    const routing = {
      capability,
      capabilities:
        Array.isArray(result.capabilities) && result.capabilities.length > 0
          ? result.capabilities
          : [capability],
      confidence: this.validateConfidence(result.confidence),
      source: this.validateSource(result.source),
    };

    const requestType = this.validateRequestType(result.requestType);
    if (requestType) {
      routing.requestType = requestType;
    }

    return routing;
  }

  validateCapability(capability) {
    if (typeof capability === "string" && VALID_CAPABILITIES.has(capability)) {
      return capability;
    }
    return "out_of_scope";
  }

  validateConfidence(confidence) {
    const value = Number(confidence);
    if (Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  validateSource(source) {
    if (VALID_SOURCES.has(source)) {
      return source;
    }
    return "RULE";
  }

  validateRequestType(requestType) {
    if (
      typeof requestType === "string" &&
      VALID_REQUEST_TYPES.has(requestType)
    ) {
      return requestType;
    }
    return null;
  }
}
