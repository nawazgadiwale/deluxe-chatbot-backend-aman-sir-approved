"use client";

import LeadCard from "../cards/LeadCard";

export default function LeadRenderer({ data = {}, message = "", onAction }) {
  if (!data) {
    return null;
  }

  /*
   * =====================================================
   * Backend Lead Response
   * =====================================================
   *
   * {
   *   status,
   *   response,
   *   form
   * }
   */

  const response = data.response ?? data.form ?? {};

  /*
   * =====================================================
   * COMPLETED LEAD
   * =====================================================
   */

  if (data.status === "COMPLETED") {
    return (
      <LeadCard
        status="COMPLETED"
        title={response.title ?? "Request Submitted Successfully"}
        subtitle={response.subtitle ?? ""}
        message={message || response.message || ""}
        lead={data.lead ?? response.lead ?? null}
      />
    );
  }

  /*
   * =====================================================
   * CUSTOMER FORM
   * =====================================================
   */

  if (data.status === "COLLECTING_CUSTOMER") {
    return (
      <LeadCard
        status="COLLECTING_CUSTOMER"
        step={response.step ?? "COLLECT_CUSTOMER"}
        title={response.title ?? "Complete Your Order"}
        subtitle={response.subtitle ?? ""}
        message={message || response.message || ""}
        description={response.description ?? ""}
        fields={response.fields ?? []}
        errors={response.errors ?? {}}
        submitAction={response.submitAction ?? null}
        onSubmit={onAction}
      />
    );
  }

  return null;
}
