export default class ResponseNode {
  async execute(state) {
    /*
     * ResponseNode executes after capability nodes finish processing
     * and right before SaveSessionNode. It ensures the assistant response
     * is finalized without altering the execution plan or persistent workflow.
     */
    if (state.response && !state.assistantMessage) {
      state.assistantMessage =
        typeof state.response === "string"
          ? state.response
          : (state.response.message || state.response.data?.message || null);
    }

    return state;
  }
}

