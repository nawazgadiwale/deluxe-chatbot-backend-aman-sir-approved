export default class ConversationValidator {
  validate(state = {}) {
    const errors = [];

    if (!state.sessionId) {
      errors.push("Session ID is required.");
    }

    if (
      state.history &&
      !Array.isArray(state.history)
    ) {
      errors.push("History must be an array.");
    }

    if (
      state.customer &&
      typeof state.customer !== "object"
    ) {
      errors.push("Customer must be an object.");
    }

    if (
      state.workflow &&
      typeof state.workflow !== "string"
    ) {
      errors.push("Workflow must be a string.");
    }

    if (
      state.currentStep &&
      typeof state.currentStep !== "string"
    ) {
      errors.push("Current step must be a string.");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}