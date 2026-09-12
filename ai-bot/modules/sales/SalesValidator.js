export default class SalesResponseBuilder {
  validate(result = {}) {
    return this.build(result);
  }

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
    context = null,

    sessionId = null,
    visitorId = null,
    whatsapp = null,
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

      context,

      sessionId,

      visitorId,

      whatsapp,
    };
  }

  error(
    message = "Something went wrong.",
    {
      interaction = "MESSAGE",
      sections = [],
      metadata = {},
      currentStep = null,
      nextStep = null,
      context = null,

      sessionId = null,
      visitorId = null,
      whatsapp = null,
    } = {},
  ) {
    return {
      success: false,

      type: "error",

      workflow: "SALES",

      interaction,

      message,

      actions: [],

      sections,

      liveRequirement: null,

      completed: false,

      metadata,

      currentStep,

      nextStep,

      context,

      sessionId,

      visitorId,

      whatsapp,
    };
  }
}
