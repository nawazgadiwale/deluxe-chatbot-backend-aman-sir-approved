export default class BaseProvider {
  sanitizeResponse(content = "") {
    if (typeof content !== "string") {
      return content;
    }

    return (
      content
        // Remove reasoning
        .replace(/<think>[\s\S]*?<\/think>/gi, "")

        // Remove markdown fences
        .replace(/^```(?:json)?/gim, "")
        .replace(/```$/gm, "")

        // Remove leading/trailing whitespace
        .trim()
    );
  }
  async invoke() {
    throw new Error("invoke() must be implemented.");
  }

  async invokeStructured() {
    throw new Error("invokeStructured() must be implemented.");
  }

  async stream() {
    throw new Error("stream() must be implemented.");
  }
}
