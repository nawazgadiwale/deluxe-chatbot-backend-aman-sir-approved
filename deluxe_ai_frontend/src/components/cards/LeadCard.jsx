"use client";

import { useEffect, useState } from "react";

import {
  User,
  Mail,
  Phone,
  Building2,
  Package,
  CheckCircle2,
  Hash,
} from "lucide-react";

export default function LeadCard({
  status = "COLLECTING_CUSTOMER",

  step = null,

  title = "",

  subtitle = "",

  message = "",

  description = "",

  fields = [],

  errors = {},

  submitAction = null,

  onSubmit,

  lead = null,

  requestType = null,
}) {
  /*
   * =====================================================
   * REQUEST TYPE
   * =====================================================
   *
   * Backend remains the source of truth.
   *
   * Supported:
   *
   * ORDER
   * QUOTATION
   * EXPERT
   * CONTACT_SALES
   */

  const resolvedRequestType =
    requestType ??
    submitAction?.requestType ??
    submitAction?.payload?.requestType ??
    lead?.requestType ??
    null;

  /*
   * =====================================================
   * FORM STATE
   * =====================================================
   */

  const [formData, setFormData] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.id, field.value ?? ""])),
  );

  /*
   * =====================================================
   * SYNC FORM WITH BACKEND
   * =====================================================
   *
   * Important when the backend changes:
   *
   * ORDER
   * QUOTATION
   * EXPERT
   * CONTACT_SALES
   *
   * or changes the form fields.
   */

  useEffect(() => {
    setFormData(
      Object.fromEntries(fields.map((field) => [field.id, field.value ?? ""])),
    );
  }, [fields]);

  /*
   * =====================================================
   * FIELD UPDATE
   * =====================================================
   */

  const updateField = (id, value) => {
    setFormData((previous) => ({
      ...previous,

      [id]: value,
    }));
  };

  /*
   * =====================================================
   * REQUEST LABELS
   * =====================================================
   */

  const getRequestConfig = () => {
    switch (resolvedRequestType) {
      case "ORDER":
        return {
          defaultTitle: "Complete Your Order",

          defaultButton: "Submit Order Request",

          defaultSubtitle:
            "Provide your contact details to submit your order request.",
        };

      case "QUOTATION":
        return {
          defaultTitle: "Request a Quotation",

          defaultButton: "Request Quotation",

          defaultSubtitle:
            "Provide your contact details so our sales team can prepare your quotation.",
        };

      case "CONTACT_SALES":
        return {
          defaultTitle: "Contact Sales",

          defaultButton: "Contact Sales",

          defaultSubtitle:
            "Provide your contact details and our sales team will contact you.",
        };

      case "EXPERT":
        return {
          defaultTitle: "Talk to an Expert",

          defaultButton: "Talk to Expert",

          defaultSubtitle:
            "Provide your contact details so our printing expert can assist you.",
        };

      default:
        return {
          defaultTitle: "Complete Your Request",

          defaultButton: "Submit Request",

          defaultSubtitle: "Provide your contact details to continue.",
        };
    }
  };

  const requestConfig = getRequestConfig();

  /*
   * =====================================================
   * SUBMIT
   * =====================================================
   */

  const submitForm = () => {
    console.log("========== LEAD FORM SUBMIT ==========");

    console.log("Request Type:", resolvedRequestType);

    console.log("Submit Action:", submitAction);

    console.log("Form Data:", formData);

    console.log("Fields:", fields);

    /*
     * -----------------------------------------------------
     * Validation
     * -----------------------------------------------------
     */

    if (!submitAction) {
      console.error("LEAD SUBMIT FAILED: submitAction is missing");

      return;
    }

    if (!onSubmit) {
      console.error("LEAD SUBMIT FAILED: onSubmit callback is missing");

      return;
    }

    /*
     * -----------------------------------------------------
     * Normalize fields
     * -----------------------------------------------------
     */

    const payload = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [
        key,

        typeof value === "string" ? value.trim() : value,
      ]),
    );

    /*
     * -----------------------------------------------------
     * Frontend validation
     * -----------------------------------------------------
     *
     * Only validate fields actually supplied
     * by the backend.
     *
     * DO NOT create requiredItem here.
     *
     * DO NOT create product information here.
     *
     * Backend is responsible for deriving those.
     */

    for (const field of fields) {
      const value = String(payload[field.id] ?? "").trim();

      if (field.required && !value) {
        console.error(`SUBMIT BLOCKED: required field "${field.id}" is empty`);

        alert(`Please enter ${field.label}`);

        return;
      }
    }

    /*
     * -----------------------------------------------------
     * Build action
     * -----------------------------------------------------
     *
     * Preserve every property supplied by backend.
     */

    const action = {
      ...submitAction,

      payload: {
        ...(submitAction.payload ?? {}),

        /*
         * Preserve request type if backend supplied it.
         */

        ...(resolvedRequestType
          ? {
              requestType: resolvedRequestType,
            }
          : {}),

        /*
         * Customer fields only.
         */

        fields: payload,
      },
    };

    console.log("========== FINAL LEAD ACTION ==========");

    console.dir(action, {
      depth: null,
    });

    onSubmit(action);
  };

  /*
   * =====================================================
   * CUSTOMER FORM
   * =====================================================
   */

  if (status === "COLLECTING_CUSTOMER") {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="bg-slate-900 px-6 py-5 text-white">
          <h2 className="font-semibold">
            {title || requestConfig.defaultTitle}
          </h2>

          {(subtitle || requestConfig.defaultSubtitle) && (
            <p className="mt-1 text-sm text-slate-300">
              {subtitle || requestConfig.defaultSubtitle}
            </p>
          )}
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="space-y-6 p-6">
          {/* =================================================
              MESSAGE
          ================================================= */}

          {message && (
            <div>
              <h3 className="mb-2 font-semibold text-slate-800">
                AI Assistant
              </h3>

              <p className="whitespace-pre-line leading-8 text-slate-700">
                {message}
              </p>
            </div>
          )}

          {/* =================================================
              DESCRIPTION
          ================================================= */}

          {description && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm leading-7 text-slate-700">{description}</p>
            </div>
          )}

          {/* =================================================
              REQUEST TYPE
          ================================================= */}

          {resolvedRequestType && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Request Type
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                {resolvedRequestType === "QUOTATION" && "Quotation Request"}

                {resolvedRequestType === "ORDER" && "Order Request"}

                {resolvedRequestType === "EXPERT" && "Expert Assistance"}

                {resolvedRequestType === "CONTACT_SALES" && "Sales Request"}
              </p>
            </div>
          )}

          {/* =================================================
              FIELDS
          ================================================= */}

          <div className="space-y-5">
            {fields.map((field) => {
              const value = formData[field.id] ?? "";

              const error = errors[field.id];

              const inputClass = `
                w-full
                rounded-2xl
                border
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:ring-4
                ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                }
              `;

              let icon = <User size={18} />;

              if (field.id === "phoneNumber") {
                icon = <Phone size={18} />;
              }

              if (field.id === "emailId") {
                icon = <Mail size={18} />;
              }

              if (field.id === "companyName") {
                icon = <Building2 size={18} />;
              }

              return (
                <div key={field.id} className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className="text-blue-600">{icon}</span>

                    {field.label}

                    {field.required && <span className="text-red-500">*</span>}
                  </label>

                  <input
                    type={
                      field.type === "email"
                        ? "email"
                        : field.type === "tel"
                          ? "tel"
                          : "text"
                    }
                    value={value}
                    placeholder={field.placeholder ?? `Enter ${field.label}`}
                    onChange={(event) =>
                      updateField(field.id, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();

                        submitForm();
                      }
                    }}
                    className={inputClass}
                  />

                  {field.description && (
                    <p className="text-xs text-slate-500">
                      {field.description}
                    </p>
                  )}

                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              );
            })}
          </div>

          {/* =================================================
              SUBMIT
          ================================================= */}

          {submitAction && (
            <div className="border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={submitForm}
                className="
                  w-full
                  rounded-2xl
                  bg-blue-600
                  px-5
                  py-3
                  font-medium
                  text-white
                  transition
                  hover:bg-blue-700
                  active:scale-[0.99]
                "
              >
                {submitAction.label ?? requestConfig.defaultButton}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /*
   * =====================================================
   * COMPLETED LEAD
   * =====================================================
   */

  if (status !== "COMPLETED" || !lead) {
    return null;
  }

  /*
   * =====================================================
   * LEAD DATA
   * =====================================================
   */

  const name = lead.name || "-";

  const phoneNumber = lead.phoneNumber || "-";

  const emailId = lead.emailId || "";

  const companyName = lead.companyName || "";

  const refNo = lead.refNo ?? "-";

  const products = Array.isArray(lead.products) ? lead.products : [];

  const completedRequestType = lead.requestType ?? resolvedRequestType;

  /*
   * =====================================================
   * COMPLETED TITLE
   * =====================================================
   */

  let completedTitle = title || "Request Submitted Successfully";

  if (completedRequestType === "ORDER") {
    completedTitle = title || "Order Request Submitted Successfully";
  }

  if (completedRequestType === "QUOTATION") {
    completedTitle = title || "Quotation Request Submitted Successfully";
  }

  if (completedRequestType === "EXPERT") {
    completedTitle = title || "Expert Request Submitted Successfully";
  }

  if (completedRequestType === "CONTACT_SALES") {
    completedTitle = title || "Sales Request Submitted Successfully";
  }

  /*
   * =====================================================
   * COMPLETED MESSAGE
   * =====================================================
   */

  let completedMessage = message;

  if (!completedMessage) {
    switch (completedRequestType) {
      case "ORDER":
        completedMessage =
          "Thank you! Your order request has been received successfully. Our sales team will contact you shortly.";

        break;

      case "QUOTATION":
        completedMessage =
          "Thank you! Your quotation request has been received. Our sales team will review your requirements and contact you shortly.";

        break;

      case "EXPERT":
        completedMessage =
          "Thank you! Your request has been received. Our printing expert will contact you shortly.";

        break;

      case "CONTACT_SALES":
        completedMessage =
          "Thank you! Your request has been received. Our sales team will contact you shortly.";

        break;

      default:
        completedMessage =
          "Thank you! Your request has been received successfully. Our sales team will contact you shortly.";
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex items-center gap-4 bg-slate-900 px-6 py-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500">
          <CheckCircle2 size={24} />
        </div>

        <div>
          <h2 className="font-semibold">{completedTitle}</h2>

          {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
        </div>
      </div>

      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="space-y-6 p-6">
        {/* MESSAGE */}

        {completedMessage && (
          <div>
            <h3 className="mb-2 font-semibold text-slate-800">AI Assistant</h3>

            <p className="whitespace-pre-line leading-8 text-slate-700">
              {completedMessage}
            </p>
          </div>
        )}

        {/* =================================================
            REFERENCE
        ================================================= */}

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash size={18} className="text-blue-600" />

              <span className="text-sm font-medium text-slate-700">
                Lead Reference
              </span>
            </div>

            <span className="font-semibold text-blue-700">#{refNo}</span>
          </div>
        </div>

        {/* =================================================
            REQUEST TYPE
        ================================================= */}

        {completedRequestType && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Request Type</p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {completedRequestType === "ORDER" && "Order Request"}

              {completedRequestType === "QUOTATION" && "Quotation Request"}

              {completedRequestType === "EXPERT" && "Expert Assistance"}

              {completedRequestType === "CONTACT_SALES" && "Sales Request"}
            </p>
          </div>
        )}

        {/* =================================================
            CUSTOMER
        ================================================= */}

        <div>
          <h3 className="mb-4 font-semibold text-slate-800">
            Contact Information
          </h3>

          <div className="space-y-3">
            {/* NAME */}

            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
              <User size={18} className="text-blue-600" />

              <div>
                <p className="text-xs text-slate-500">Full Name</p>

                <p className="text-sm font-medium text-slate-800">{name}</p>
              </div>
            </div>

            {/* PHONE */}

            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
              <Phone size={18} className="text-blue-600" />

              <div>
                <p className="text-xs text-slate-500">Phone Number</p>

                <p className="text-sm font-medium text-slate-800">
                  {phoneNumber}
                </p>
              </div>
            </div>

            {/* EMAIL */}

            {emailId && (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                <Mail size={18} className="text-blue-600" />

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Email Address</p>

                  <p className="break-all text-sm font-medium text-slate-800">
                    {emailId}
                  </p>
                </div>
              </div>
            )}

            {/* COMPANY */}

            {companyName && (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                <Building2 size={18} className="text-blue-600" />

                <div>
                  <p className="text-xs text-slate-500">Company</p>

                  <p className="text-sm font-medium text-slate-800">
                    {companyName}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            PRODUCTS
        ================================================= */}

        {products.length > 0 && (
          <div>
            <h3 className="mb-4 font-semibold text-slate-800">
              Requested Products
            </h3>

            <div className="space-y-3">
              {products.map((product, index) => {
                const productName =
                  product?.productName ??
                  product?.name ??
                  product?.title ??
                  "-";

                /*
                 * Product ID can be:
                 *
                 * number
                 * string
                 * null
                 */

                const productId = product?.productId ?? product?.id ?? null;

                return (
                  <div
                    key={productId ?? `${productName}-${index}`}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"
                  >
                    <Package size={18} className="text-blue-600" />

                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Product</p>

                      <p className="text-sm font-medium text-slate-800">
                        {productName}
                      </p>

                      {productId !== null && (
                        <p className="mt-1 text-xs text-slate-400">
                          ID: {String(productId)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================
            NEXT STEP
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-2 font-semibold text-slate-800">
            What happens next?
          </h3>

          <p className="text-sm leading-7 text-slate-600">
            Thank you for choosing Deluxe Printing. Your request has been
            received successfully. Our sales team will contact you shortly using
            the contact details you provided.
          </p>
        </div>
      </div>
    </div>
  );
}
