export default class ResponseBuilder {
  /*
   * =====================================================
   * Base Response
   * =====================================================
   */

  success({
    type = "text",
    message = null,
    data = {},
    actions = [],
    metadata = {},
  } = {}) {
    return {
      success: true,
      type,
      message,
      data,
      actions,
      metadata,
    };
  }

  /*
   * =====================================================
   * Recommendation
   * =====================================================
   */

  recommendation(data, metadata = {}) {
    return this.success({
      type: "recommendation",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * Product Details
   * (same renderer as recommendation)
   * =====================================================
   */

  productDetails(data, metadata = {}) {
    return this.success({
      type: "product_details",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * Sales
   * =====================================================
   */

  sales(data, metadata = {}) {
    return this.success({
      type: "sales",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * Sales Completed
   * =====================================================
   */

  salesCompleted(data = {}, metadata = {}) {
    return this.success({
      type: "sales_completed",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }
  /*
   * =====================================================
   * Append Resume Workflow Prompt
   * =====================================================
   */

  appendResumePrompt(response, pausedWorkflow) {
    if (!pausedWorkflow) {
      return response;
    }

    const workflowLabels = {
      LEAD: "quote request",
      ORDER: "order",
      RECOMMENDATION: "recommendation",
    };

    const workflow = workflowLabels[pausedWorkflow.workflow] ?? "request";

    response.data ??= {};
    response.actions ??= [];

    response.data.followUpQuestion = `You still have an unfinished ${workflow}. Would you like to continue?`;

    response.actions.push(
      {
        id: "RESUME_WORKFLOW",
        label: `Continue ${workflow}`,
        payload: {},
      },
      {
        id: "CANCEL_WORKFLOW",
        label: "Cancel",
        payload: {},
      },
    );

    return response;
  }
  /*
   *comparison
   */

  comparison(data, metadata = {}) {
    return this.success({
      type: "comparison",

      data: {
        summary: data.summary,

        comparison: data.comparison ?? [],

        winner: data.winner ?? {
          product: "",
          reason: "",
        },

        recommendation: data.recommendation ?? {
          message: "",
          alternative: "",
        },

        followUpQuestion: data.followUpQuestion ?? "",

        products: data.products ?? [],
      },

      actions: data.actions ?? [],

      metadata,
    });
  }

  /*
   * =====================================================
   * out of scope
   * =====================================================
   */
  outOfScope(data, metadata = {}) {
    return this.success({
      type: "out_of_scope",

      data: {
        title: data.title,
        message: data.message,
        suggestions: data.suggestions ?? [],
      },

      actions: data.actions ?? [],

      metadata,
    });
  }

  /*
   * =====================================================
   * Lead
   * =====================================================
   */

  lead(data, metadata = {}) {
    return this.success({
      type: "lead",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * FAQ
   * =====================================================
   */

  faq(data, metadata = {}) {
    return this.success({
      type: "faq",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * Support
   * =====================================================
   */

  support(data, metadata = {}) {
    return this.success({
      type: "support",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * Quotation
   * =====================================================
   */

  quotation(data, metadata = {}) {
    return this.success({
      type: "quotation",
      data,
      actions: data?.actions ?? [],
      metadata,
    });
  }

  /*
   * =====================================================
   * Text
   * =====================================================
   */

  text(message, actions = [], metadata = {}) {
    return this.success({
      type: "text",
      message,
      actions,
      metadata,
    });
  }

  /*
   * =====================================================
   * Error
   * =====================================================
   */

  error(message, metadata = {}) {
    return {
      success: false,
      type: "error",
      message,
      data: {},
      actions: [],
      metadata,
    };
  }
}
