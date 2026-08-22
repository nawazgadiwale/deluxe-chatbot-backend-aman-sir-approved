import SalesResponseBuilder from "./builders/SalesResponseBuilder.js";

const responseBuilder = new SalesResponseBuilder();

export default class SalesValidator {
  validate(response = {}) {
    return responseBuilder.build({
      workflow: response.workflow ?? "SALES",

      interaction: response.interaction ?? "MESSAGE",

      message: response.message ?? "",

      actions: response.actions ?? [],

      sections: response.sections ?? [],

      liveRequirement: response.liveRequirement ?? {},

      completed: response.completed ?? false,

      metadata: response.metadata ?? {},

      currentStep: response.currentStep ?? null,

      nextStep: response.nextStep ?? null,

      context: response.context ?? null,
    });
  }
}
