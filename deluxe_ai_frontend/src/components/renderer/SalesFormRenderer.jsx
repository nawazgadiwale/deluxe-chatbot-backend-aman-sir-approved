"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileUp, MessageCircle, Truck, UserRound } from "lucide-react";

/* =====================================================
   Helpers
===================================================== */

const DEFAULT_STATE = {
  fields: {},
  requirements: {},
  addons: [],
  quantity: null,
  artwork: {},
  delivery: {},
  customer: {},
};

function empty(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function optionValue(option = {}) {
  return option.value ?? option.id ?? option.name ?? option.label;
}

function optionLabel(option = {}) {
  return option.label ?? option.name ?? option.value ?? option.id;
}

function cloneFormState(form = {}) {
  const state = {
    fields: {},
    requirements: {},
    addons: [],
    quantity: null,
    artwork: {},
    delivery: {},
    customer: {},
  };

  for (const section of form.sections ?? []) {
    if (section.id === "addons") {
      state.addons = (section.fields ?? [])
        .filter((field) => field.selected)
        .map((field) => field.id);
      continue;
    }

    for (const field of section.fields ?? []) {
      let value = field.value;

      if (value === undefined || value === null) {
        if (field.type === "checkbox") value = false;
        else if (field.type === "multiselect") value = [];
        else value = "";
      }

      if (section.id === "product_fields") {
        state.fields[field.id] = value;

        if (field.mapsTo === "delivery.method") {
          state.delivery.method = value;
        }

        if (field.mapsTo === "workflow.quantity") {
          state.quantity = value;
        }
      } else if (section.id === "requirements") {
        state.requirements[field.id] = value;
      } else if (section.id === "order") {
        state.quantity = value;
      } else if (section.id === "artwork") {
        state.artwork[field.id] = value;
      } else if (section.id === "delivery") {
        state.delivery[field.id] = value;
      } else if (section.id === "customer") {
        state.customer[field.id] = value;
      } else {
        // Unknown catalog section: never discard its field.
        state.fields[field.id] = value;
      }
    }
  }

  // Backend may return initial values separately.
  if (form.values && typeof form.values === "object") {
    Object.assign(state.fields, form.values);
  }

  return state;
}

function getValue(state, section, field) {
  switch (section.id) {
    case "product_fields":
      return state.fields[field.id];
    case "requirements":
      return state.requirements[field.id];
    case "order":
      return state.quantity;
    case "artwork":
      return state.artwork[field.id];
    case "delivery":
      return state.delivery[field.id];
    case "customer":
      return state.customer[field.id];
    default:
      return state.fields[field.id];
  }
}

function updateValue(state, section, field, value) {
  if (section.id === "product_fields") {
    const next = {
      ...state,
      fields: { ...state.fields, [field.id]: value },
    };

    if (field.mapsTo === "delivery.method") {
      next.delivery = { ...state.delivery, method: value };
    }

    if (field.mapsTo === "workflow.quantity") {
      next.quantity = value;
    }

    return next;
  }

  if (section.id === "requirements") {
    return {
      ...state,
      requirements: {
        ...state.requirements,
        [field.id]: value,
      },
    };
  }

  if (section.id === "order") {
    return { ...state, quantity: value };
  }

  if (section.id === "artwork") {
    return {
      ...state,
      artwork: { ...state.artwork, [field.id]: value },
    };
  }

  if (section.id === "delivery") {
    return {
      ...state,
      delivery: { ...state.delivery, [field.id]: value },
    };
  }

  if (section.id === "customer") {
    return {
      ...state,
      customer: { ...state.customer, [field.id]: value },
    };
  }

  return {
    ...state,
    fields: { ...state.fields, [field.id]: value },
  };
}

function isVisible(field, state) {
  if (!field.conditional) {
    return true;
  }

  const source =
    state.delivery?.[field.conditional.field] ??
    state.fields?.[field.conditional.field] ??
    state.requirements?.[field.conditional.field];

  return source === field.conditional.equals;
}

function getFieldError(errors, section, field) {
  const group = section.id === "product_fields" ? "fields" : section.id;

  return (
    errors.find(
      (error) =>
        error.field === `${group}.${field.id}` || error.field === field.id,
    )?.message ?? ""
  );
}

/* =====================================================
   Choice Buttons
===================================================== */

function ChoiceButtons({ field, value, onChange }) {
  const options = field.options ?? [];

  if (!options.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const value_ = optionValue(option);

        const selected = String(value ?? "") === String(value_);

        return (
          <button
            key={option.id ?? value_}
            type="button"
            onClick={() => onChange(value_)}
            className={[
              "min-h-[40px] rounded-md border px-4 py-2",
              "text-sm font-medium transition",
              selected
                ? "border-emerald-500 bg-white text-slate-700 ring-1 ring-emerald-500"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50",
            ].join(" ")}
          >
            <span className="flex items-center gap-1.5">
              {selected && <Check className="h-3.5 w-3.5 text-emerald-500" />}

              {optionLabel(option)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================
   Quantity
===================================================== */

function QuantityField({ field, value, onChange }) {
  const options = field.options ?? [];

  if (!options.length) {
    return (
      <input
        type="number"
        min={field.minimum ?? 1}
        max={field.maximum}
        value={value ?? ""}
        placeholder={field.placeholder ?? "Enter quantity"}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : Number(event.target.value))
        }
        className="
          h-10
          w-full
          rounded-md
          border
          border-slate-200
          px-3
          text-sm
          outline-none
          focus:border-emerald-500
          focus:ring-2
          focus:ring-emerald-100
        "
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const value_ = optionValue(option);

        const selected = Number(value) === Number(value_);

        return (
          <button
            key={option.id ?? value_}
            type="button"
            onClick={() => onChange(Number(value_))}
            className={[
              "min-w-[52px] rounded-md border px-4 py-2",
              "text-sm font-medium transition",
              selected
                ? "border-emerald-500 bg-white text-slate-700 ring-1 ring-emerald-500"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50",
            ].join(" ")}
          >
            <span className="flex items-center justify-center gap-1.5">
              {selected && <Check className="h-3.5 w-3.5 text-emerald-500" />}

              {optionLabel(option)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================
   Multiselect
===================================================== */

function MultiSelectField({ field, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];

  return (
    <div className="flex flex-wrap gap-2">
      {(field.options ?? []).map((option) => {
        const value_ = optionValue(option);

        const active = selected.includes(value_);

        return (
          <button
            key={option.id ?? value_}
            type="button"
            onClick={() =>
              onChange(
                active
                  ? selected.filter((item) => item !== value_)
                  : [...selected, value_],
              )
            }
            className={[
              "rounded-md border px-3 py-2",
              "text-sm transition",
              active
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300",
            ].join(" ")}
          >
            <span className="flex items-center gap-2">
              {active && <Check className="h-3.5 w-3.5" />}

              {optionLabel(option)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================
   Dynamic Field
===================================================== */

function DynamicField({ field, section, state, onChange, error }) {
  const value = getValue(state, section, field);

  const type = String(field.type ?? "text").toLowerCase();

  /* QUANTITY */

  if (type === "quantity" || field.mapsTo === "workflow.quantity") {
    return <QuantityField field={field} value={value} onChange={onChange} />;
  }

  /* SELECT / RADIO / OPTION-DRIVEN CATALOG FIELD */

  if (
    type === "select" ||
    type === "radio" ||
    type === "confirmation" ||
    (Array.isArray(field.options) && field.options.length > 0)
  ) {
    return <ChoiceButtons field={field} value={value} onChange={onChange} />;
  }

  /* MULTISELECT */

  if (type === "multiselect") {
    return <MultiSelectField field={field} value={value} onChange={onChange} />;
  }

  /* CHECKBOX */

  if (type === "checkbox") {
    return (
      <label
        className="
        inline-flex
        cursor-pointer
        items-center
        gap-2
        rounded-md
        border
        border-slate-200
        bg-white
        px-3
        py-2
        text-sm
        text-slate-700
      "
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="
            h-4
            w-4
            accent-emerald-500
          "
        />

        {field.description ?? field.label}
      </label>
    );
  }

  /* COMMON INPUT */

  const inputClass = [
    "w-full rounded-md border px-3 py-2.5",
    "text-sm outline-none transition",
    error
      ? "border-red-400 focus:border-red-500"
      : "border-slate-200 focus:border-emerald-500",
  ].join(" ");

  /* TEXTAREA */

  if (type === "textarea") {
    return (
      <textarea
        className={inputClass}
        value={value ?? ""}
        rows={3}
        placeholder={field.placeholder ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  /* FILE */

  if (type === "file") {
    return (
      <label className="flex cursor-pointer flex-col gap-2">
        <span
          className="
          inline-flex
          w-fit
          items-center
          gap-2
          rounded-md
          border
          border-slate-200
          bg-white
          px-4
          py-2
          text-sm
          font-medium
          text-slate-700
          hover:border-emerald-300
        "
        >
          <FileUp className="h-4 w-4" />
          Choose File
        </span>

        <input
          type="file"
          className="hidden"
          accept={field.accept ?? ".pdf,.ai,.eps,.svg,.cdr,.jpg,.jpeg,.png"}
          onChange={(event) => {
            const file = event.target.files?.[0];

            onChange(
              file
                ? {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                  }
                : null,
            );
          }}
        />

        <span className="text-[10px] text-slate-400">
          {value?.name ?? "No file chosen"}

          {field.acceptLabel ? ` (${field.acceptLabel})` : ""}
        </span>
      </label>
    );
  }

  /* DATE */

  if (type === "date") {
    return (
      <input
        type="date"
        className={inputClass}
        min={field.minimum}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  /* NUMBER / TEXT / EMAIL / TEL */

  const inputType = ["text", "number", "email", "tel"].includes(type)
    ? type
    : "text";

  return (
    <input
      type={inputType}
      className={inputClass}
      min={field.minimum}
      max={field.maximum}
      value={value ?? ""}
      placeholder={field.placeholder ?? ""}
      onChange={(event) =>
        onChange(
          inputType === "number" && event.target.value !== ""
            ? Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

/* =====================================================
   Section Header
===================================================== */

function SectionHeader({ number, section }) {
  let Icon = null;

  if (section.id === "delivery") {
    Icon = Truck;
  }

  if (section.id === "customer") {
    Icon = UserRound;
  }

  return (
    <div className="flex items-center gap-2">
      {Icon ? (
        <Icon className="h-4 w-4 text-slate-600" />
      ) : (
        <span className="text-sm text-slate-500">▧</span>
      )}

      <h3
        className="
        text-sm
        font-semibold
        uppercase
        tracking-wide
        text-slate-700
      "
      >
        {number}. {section.title ?? "Order Details"}
      </h3>

      {section.description && (
        <span
          className="
          text-[10px]
          font-normal
          normal-case
          text-slate-400
        "
        >
          ({section.description})
        </span>
      )}
    </div>
  );
}

/* =====================================================
   WhatsApp Quantity
===================================================== */

function QuantityHelp() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  const href = number
    ? `https://wa.me/${String(number).replace(
        /\D/g,
        "",
      )}?text=${encodeURIComponent(
        "I need a quantity above the available options.",
      )}`
    : null;

  return (
    <a
      href={href ?? "#"}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      onClick={(event) => {
        if (!href) {
          event.preventDefault();
        }
      }}
      className="
        mt-3
        flex
        items-center
        gap-3
        rounded-md
        border
        border-emerald-200
        bg-emerald-50/60
        px-3
        py-2.5
      "
    >
      <MessageCircle
        className="
          h-5
          w-5
          shrink-0
          text-emerald-500
        "
      />

      <span>
        <span
          className="
          block
          text-xs
          font-semibold
          text-slate-700
        "
        >
          Need to Order More Quantity?
        </span>

        <span
          className="
          block
          text-[11px]
          text-slate-500
        "
        >
          Chat With Our Expert.
        </span>
      </span>
    </a>
  );
}

/* =====================================================
   Sales Form
===================================================== */

export default function SalesFormRenderer({ data = {}, onAction }) {
  /*
   * Normalize common response wrappers. This keeps the form renderer
   * independent from the chat transport shape.
   */
  const salesData =
    data?.data && typeof data.data === "object"
      ? data.data
      : data?.response && typeof data.response === "object"
        ? data.response
        : data?.result && typeof data.result === "object"
          ? data.result
          : data;
  /*
   * =====================================================
   * BACKEND FORM NORMALIZATION
   * =====================================================
   *
   * Canonical backend response:
   *
   * data.sections[]
   *   -> ORDER_FORM
   *      -> form
   *         -> fields[]
   *
   * The old renderer expected data.form.sections[], which is
   * why it displayed "No order fields are available".
   *
   * Normalize the backend contract once. The rest of the
   * component remains catalog-driven.
   */
  const backendOrderSection = useMemo(
    () =>
      (Array.isArray(salesData?.sections) ? salesData.sections : []).find(
        (section) =>
          section?.id === "ORDER_FORM" ||
          section?.type === "ORDER_FORM" ||
          section?.form,
      ) ?? null,
    [salesData?.sections],
  );

  /*
   * The backend may expose the form through any of these locations:
   *
   * data.sections[].form
   * data.form
   * data.metadata.form
   * data.context.form
   *
   * Prefer the canonical ORDER_FORM section first.
   */
  const backendForm =
    backendOrderSection?.form ??
    salesData?.form ??
    salesData?.metadata?.form ??
    salesData?.context?.form ??
    {};

  const catalogFields = Array.isArray(backendForm?.fields)
    ? backendForm.fields
    : Array.isArray(backendForm?.form?.fields)
      ? backendForm.form.fields
      : [];

  const form = useMemo(
    () => ({
      ...backendForm,

      id: backendForm?.id ?? backendForm?.formId ?? "catalog-order-form",

      productId: backendForm?.productId ?? backendForm?.product?.id ?? null,

      selectionId: backendForm?.selectionId ?? backendForm?.variant?.id ?? null,

      submitAction:
        backendForm?.submitAction ??
        backendForm?.submit?.action ??
        "SUBMIT_ORDER_FORM",

      submitLabel:
        backendForm?.submitLabel ?? backendForm?.submit?.label ?? "Continue",

      /*
       * If backend already provides sections, preserve them.
       * Otherwise convert form.fields[] into product_fields.
       */
      sections:
        Array.isArray(backendForm?.sections) && backendForm.sections.length > 0
          ? backendForm.sections
          : [
              {
                id: "product_fields",
                title: backendForm?.title ?? "Order Details",
                description: backendForm?.description ?? "",
                fields: catalogFields,
              },
            ],
    }),
    [backendForm, catalogFields],
  );

  const [formState, setFormState] = useState(() => cloneFormState(form));

  const [clientErrors, setClientErrors] = useState([]);

  const lastFormKey = useRef("");

  /*
   * Reset state when a genuinely
   * new product/variant form arrives.
   */
  const formKey = useMemo(
    () =>
      [
        form.id,
        form.productId,
        form.selectionId,
        form.submitAction,
        JSON.stringify(form.sections ?? []),
      ].join("|"),
    [form],
  );

  useEffect(() => {
    if (lastFormKey.current !== formKey) {
      setFormState(cloneFormState(form));

      setClientErrors([]);

      lastFormKey.current = formKey;
    }
  }, [form, formKey]);

  const errors = useMemo(
    () => [...(salesData.errors ?? []), ...clientErrors],
    [salesData.errors, clientErrors],
  );

  /*
   * Conditional sections/fields
   */
  const visibleSections = useMemo(
    () =>
      (form.sections ?? [])
        .map((section) => ({
          ...section,

          fields: (section.fields ?? []).filter((field) =>
            isVisible(field, formState),
          ),
        }))
        .filter((section) => section.fields.length),
    [form.sections, formState],
  );

  /*
   * Field update
   */
  const updateField = (section, field, value) => {
    setFormState((current) => updateValue(current, section, field, value));

    setClientErrors((current) =>
      current.filter(
        (error) =>
          error.field !== `${section.id}.${field.id}` &&
          error.field !== `fields.${field.id}` &&
          error.field !== field.id,
      ),
    );
  };

  /*
   * =====================================================
   * SUBMIT
   * =====================================================
   *
   * The browser does not save the lead/order.
   * It sends the completed dynamic catalog form to the
   * backend through the existing onAction -> useChat flow.
   */
  const submit = () => {
    const nextErrors = [];

    for (const section of visibleSections) {
      if (section.id === "addons") {
        if (section.required && formState.addons.length === 0) {
          nextErrors.push({
            field: "addons",
            message: "Please select a required add-on.",
          });
        }
        continue;
      }

      for (const field of section.fields ?? []) {
        const value = getValue(formState, section, field);

        if (field.required && empty(value)) {
          nextErrors.push({
            field:
              section.id === "product_fields"
                ? `fields.${field.id}`
                : `${section.id}.${field.id}`,
            message: `${field.label ?? "This field"} is required.`,
          });
        }
      }
    }

    if (
      formState.quantity !== null &&
      formState.quantity !== "" &&
      (!Number.isFinite(Number(formState.quantity)) ||
        Number(formState.quantity) < 1)
    ) {
      nextErrors.push({
        field: "quantity",
        message: "Please enter a valid quantity.",
      });
    }

    if (
      formState.customer.email &&
      !/^\S+@\S+\.\S+$/.test(formState.customer.email)
    ) {
      nextErrors.push({
        field: "customer.email",
        message: "Please enter a valid email address.",
      });
    }

    setClientErrors(nextErrors);

    if (nextErrors.length > 0) {
      return;
    }

    /*
     * IMPORTANT:
     * Product and variant identity come from the backend form.
     * Do not derive them from the visible text.
     */
    /*
     * The backend validator expects a flat map:
     *
     *   { quantity, artwork, material, lamination, ... }
     *
     * Do not send the internal React state shape ({ fields, requirements,
     * delivery, ... }) as the validation payload.
     */
    const submittedValues = {};

    for (const section of form.sections ?? []) {
      for (const field of section.fields ?? []) {
        const value = getValue(formState, section, field);

        if (value !== undefined && value !== null) {
          submittedValues[field.id] = value;
        }
      }
    }

    /*
     * `form.sections` is normally normalized from form.fields, but keep
     * this fallback for a backend form that exposes only fields[].
     */
    if (
      Object.keys(submittedValues).length === 0 &&
      Array.isArray(form.fields)
    ) {
      for (const field of form.fields) {
        const section = (form.sections ?? []).find((item) =>
          (item.fields ?? []).some((candidate) => candidate.id === field.id),
        ) ?? {
          id: "product_fields",
          fields: [field],
        };

        submittedValues[field.id] = getValue(formState, section, field);
      }
    }

    /*
     * Preserve add-ons even when they are represented by the legacy
     * internal addons state.
     */
    if (formState.addons.length > 0) {
      submittedValues.addons = [...formState.addons];
    }

    const completedForm = {
      formId: form.id,
      productId: form.productId ?? form.product?.id ?? null,
      selectionId: form.selectionId ?? form.variant?.id ?? null,
      values: submittedValues,

      /*
       * Keep a compatibility copy for existing callers that read
       * payload.form directly.
       */
      ...submittedValues,
    };

    const action = {
      id: form.submitAction ?? "SUBMIT_ORDER_FORM",
      label: form.submitLabel ?? "Continue",
      payload: {
        formId: form.id,
        values: submittedValues,
        form: completedForm,
      },
    };

    console.log("========== DYNAMIC FORM SUBMIT ==========");
    console.dir(action, { depth: null });

    onAction?.(action);
  };

  return (
    <div
      className="
      w-full
      overflow-hidden
      rounded-xl
      border
      border-slate-200
      bg-white
      shadow-sm
    "
    >
      {/* HEADER */}

      <div
        className="
        border-b
        border-slate-200
        bg-white
        px-4
        py-3
      "
      >
        <h2
          className="
          text-base
          font-semibold
          text-slate-800
        "
        >
          {form.title ?? "Order Details"}
        </h2>

        {form.description && (
          <p
            className="
            mt-1
            text-xs
            text-slate-500
          "
          >
            {form.description}
          </p>
        )}
      </div>

      {/* SELECTED PRODUCT / VARIANT */}

      {(form.product || form.variant) && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Selected
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-800">
            {form.product?.name ?? "Product"}
          </div>

          {form.variant?.name && (
            <div className="mt-0.5 text-xs text-slate-500">
              {form.variant.name}
            </div>
          )}
        </div>
      )}

      {/* SECTIONS */}

      <div
        className="
        divide-y
        divide-slate-200
      "
      >
        {visibleSections.map((section, sectionIndex) => {
          const number = sectionIndex + 1;

          const isQuantitySection =
            section.id === "order" ||
            section.fields.some(
              (field) =>
                field.id === "quantity" || field.mapsTo === "workflow.quantity",
            );

          return (
            <section
              key={section.id}
              className="
                  px-4
                  py-4
                "
            >
              <SectionHeader number={number} section={section} />

              <div
                className="
                  mt-3
                  space-y-3
                "
              >
                {section.fields.map((field) => {
                  const error = getFieldError(errors, section, field);

                  return (
                    <div key={field.id}>
                      {/* LABEL */}

                      <div
                        className="
                            mb-2
                            flex
                            items-center
                            gap-2
                          "
                      >
                        <label
                          className="
                              text-xs
                              font-medium
                              text-slate-500
                            "
                        >
                          {field.label}

                          {field.required && (
                            <span
                              className="
                                  ml-1
                                  text-red-500
                                "
                            >
                              *
                            </span>
                          )}
                        </label>
                      </div>

                      {/* FIELD */}

                      <DynamicField
                        field={field}
                        section={section}
                        state={formState}
                        error={error}
                        onChange={(value) => updateField(section, field, value)}
                      />

                      {/* DESCRIPTION */}

                      {field.description &&
                        field.type !== "checkbox" &&
                        field.type !== "file" && (
                          <p
                            className="
                                mt-1
                                text-[10px]
                                leading-4
                                text-slate-400
                              "
                          >
                            {field.description}
                          </p>
                        )}

                      {/* ERROR */}

                      {error && (
                        <p
                          className="
                              mt-1
                              text-xs
                              text-red-600
                            "
                        >
                          {error}
                        </p>
                      )}

                      {/* QUANTITY HELP */}

                      {isQuantitySection &&
                        (field.id === "quantity" ||
                          field.mapsTo === "workflow.quantity") && (
                          <QuantityHelp />
                        )}
                    </div>
                  );
                })}

                {/* ADDONS */}

                {section.id === "addons" && (
                  <div
                    className="
                      grid
                      gap-2
                      sm:grid-cols-2
                    "
                  >
                    {section.fields.map((addon) => {
                      const selected = formState.addons.includes(addon.id);

                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() =>
                            setFormState((current) => ({
                              ...current,

                              addons: selected
                                ? current.addons.filter((id) => id !== addon.id)
                                : [...current.addons, addon.id],
                            }))
                          }
                          className={[
                            "flex items-center gap-3 rounded-md border px-3 py-2.5",
                            "text-left text-sm transition",

                            selected
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-emerald-300",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",

                              selected
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300",
                            ].join(" ")}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>

                          <span className="min-w-0">
                            <span
                              className="
                                  block
                                  font-medium
                                  text-slate-700
                                "
                            >
                              {addon.label ?? addon.name}
                            </span>

                            {addon.description && (
                              <span
                                className="
                                    block
                                    text-[10px]
                                    text-slate-400
                                  "
                              >
                                {addon.description}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* EMPTY */}

      {visibleSections.length === 0 && (
        <div
          className="
          px-4
          py-6
          text-sm
          text-slate-500
        "
        >
          No order fields are available.
        </div>
      )}

      {/* SUBMIT */}

      <div
        className="
        border-t
        border-slate-200
        bg-slate-50
        px-4
        py-3
      "
      >
        <button
          type="button"
          onClick={submit}
          className="
            w-full
            rounded-md
            bg-emerald-500
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-emerald-600
            focus:outline-none
            focus:ring-2
            focus:ring-emerald-200
          "
        >
          {form.submitLabel ?? form.submit?.label ?? "Continue"}
        </button>
      </div>
    </div>
  );
}
