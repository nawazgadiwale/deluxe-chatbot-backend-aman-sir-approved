const InteractionTypes = Object.freeze({
  MESSAGE: "MESSAGE",
  OPTIONS: "OPTIONS",
  MULTI_SELECT: "MULTI_SELECT",
  INPUT: "INPUT",

  // Internal/web response
  FORM: "FORM",
  SUMMARY: "SUMMARY",
  COMPLETED: "COMPLETED",

  // WhatsApp-specific rendering instruction
  WHATSAPP_FLOW: "WHATSAPP_FLOW",
});

export default InteractionTypes;
