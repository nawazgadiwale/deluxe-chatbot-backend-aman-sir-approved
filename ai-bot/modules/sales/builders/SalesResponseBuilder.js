export default class SalesResponseBuilder {
  build({
    interaction = "MESSAGE",
    message = "",
    actions = [],
    sections = [],
    liveRequirement = null,
    completed = false,
    workflow = "SALES",
    metadata = {},
    currentStep = null,
    nextStep = null,

    // =====================================================
    // Decision Context
    // =====================================================
    context = null,
  } = {}) {
    return {
      success: true,

      type: "sales",

      workflow,

      interaction,

      message,

      actions,

      sections,

      liveRequirement,

      completed,

      metadata,

      currentStep,

      nextStep,

      // IMPORTANT:
      // Keeps COLLECT_CUSTOMER field information available
      // to the frontend.
      context,
    };
  }

  error(message = "Something went wrong.") {
    return {
      success: false,

      type: "error",

      message,

      workflow: "SALES",

      interaction: "MESSAGE",

      actions: [],

      sections: [],

      liveRequirement: null,

      completed: false,

      metadata: {},

      currentStep: null,

      nextStep: null,

      context: null,
    };
  }
}
