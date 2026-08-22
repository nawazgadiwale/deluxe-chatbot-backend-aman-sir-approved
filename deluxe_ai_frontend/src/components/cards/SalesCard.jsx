"use client";

import {
  Bot,
  Package,
  User,
  Truck,
  DollarSign,
  ClipboardList,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import ActionButton from "./ActionButton";

/*
 * =====================================================
 * Helpers
 * =====================================================
 */

function formatLabel(key = "") {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-slate-400">Pending</span>;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    if (value.name) return value.name;
    if (value.label) return value.label;
    if (value.value) return value.value;

    return JSON.stringify(value);
  }

  return String(value);
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-[150px] text-sm font-medium text-slate-500">
        {label}
      </div>

      <div className="text-sm text-right text-slate-800 break-words">
        {formatValue(value)}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3">
        <Icon className="h-5 w-5 text-blue-600" />

        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}

/*
 * =====================================================
 * Sales Card
 * =====================================================
 */

export default function SalesCard({
  message = "",
  metadata = {},
  actions = [],
}) {
  /*
   * =====================================================
   * Backend Context
   * =====================================================
   */

  const {
    product = {},
    recommendation = {},
    field = {},
    requirement = {},
    addons = {},
    options = [],
    order = {},
  } = metadata;

  /*
   * =====================================================
   * Product
   * =====================================================
   */

  const orderItem = order?.items?.[0] ?? {};

  const productData = orderItem.productData ?? {};
  const workflow = orderItem.workflow ?? {};
  const addonsData = orderItem.addons ?? {};
  const itemPricing = orderItem.pricing ?? {};
  const selection = orderItem.selection ?? metadata.selection ?? {};

  const selectionFeatures = selection?.features ?? [];
  const productFeatures = product?.features ?? [];
  const availableAddons = addons?.options ?? [];
  const selectedAddons = addonsData?.items ?? [];

  const displayProduct = selection?.id
    ? selection
    : recommendation?.id
      ? recommendation
      : product;

  const productImage =
    displayProduct?.image ||
    displayProduct?.images?.[0] ||
    product?.image ||
    product?.images?.[0] ||
    null;

  const features =
    displayProduct?.features ??
    recommendation?.features ??
    product?.features ??
    [];

  const price =
    displayProduct?.startingPrice ?? recommendation?.startingPrice ?? null;

  /*
   * =====================================================
   * Conversation State
   * =====================================================
   */

  /*
   * =====================================================
   * Conversation State
   * =====================================================
   */

  const stage = metadata.stage ?? "";

  const isRecommendation = stage === "RECOMMEND_SELECTION";

  const isComparison = stage === "SELECT_SELECTION" && options.length > 0;

  const isField =
    stage === "COLLECT_PRODUCT_FIELD" || stage === "COLLECT_REQUIREMENT";

  const isQuantity = stage === "COLLECT_QUANTITY";

  const isAddons = stage === "SELECT_ADDONS";

  const isArtwork = stage === "COLLECT_ARTWORK";

  const isDelivery = stage === "SELECT_DELIVERY_METHOD";

  const isAddress = stage === "ASK_DELIVERY_ADDRESS";

  const isDate = stage === "ASK_DELIVERY_DATE";

  const isReview = stage === "REVIEW_ORDER" || stage === "COMPLETE_ORDER";

  const isCompleted = stage === "ORDER_COMPLETED";

  const isEdit = stage === "EDIT_ORDER";

  const isConfirmation = stage === "COMPLETE_ORDER";

  const isSelectedVariant =
    !!selection?.id &&
    !isField &&
    !isQuantity &&
    !isAddons &&
    !isArtwork &&
    !isDelivery &&
    !isAddress &&
    !isDate &&
    !isReview &&
    !isCompleted;

  const isOrderCollection =
    isField ||
    isQuantity ||
    isAddons ||
    isArtwork ||
    isDelivery ||
    isAddress ||
    isDate;

  console.log("========== SALES CARD ==========");
  console.log("stage", stage);
  console.log("metadata", metadata);
  console.log("addons", addons);
  console.log("availableAddons", availableAddons);
  console.log("actions", actions);
  console.log("isAddons", isAddons);

  /*
   * =====================================================
   * Render Helpers
   * =====================================================
   */

  function renderFeatureList(features = []) {
    if (!features.length) return null;

    return (
      <div className="grid gap-3">
        {features.map((feature) => (
          <div
            key={feature}
            className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
          >
            <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600">
              ✓
            </div>

            <div className="text-sm leading-6 text-slate-700">{feature}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderAddonList() {
    if (!availableAddons.length) return null;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {availableAddons.map((addon) => {
          const selected = selectedAddons.some((item) => item.id === addon.id);

          return (
            <div
              key={addon.id}
              className={`relative overflow-hidden rounded-2xl border p-5 transition ${
                selected
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* Small Image */}
              {addon.image && (
                <img
                  src={addon.image}
                  alt={addon.name}
                  className="absolute right-4 top-4 h-14 w-14 rounded-lg border border-slate-200 bg-white object-cover"
                />
              )}

              <div className="pr-20">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900">{addon.name}</h4>

                  {selected && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                      Selected
                    </span>
                  )}
                </div>

                {addon.price && (
                  <div className="mt-4">
                    <div className="text-3xl font-bold text-green-600">
                      {addon.price.currency} {addon.price.amount}
                    </div>

                    {addon.price.unit && (
                      <div className="text-sm text-slate-500">
                        {addon.price.unit}
                      </div>
                    )}
                  </div>
                )}

                {addon.description && (
                  <p className="mt-5 text-sm leading-6 text-slate-600">
                    {addon.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {/* ===========================================
          Header
      =========================================== */}

      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="flex items-center gap-4 p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20">
            <Bot className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              Deluxe AI Sales Consultant
            </h2>

            <p className="mt-1 text-sm text-blue-100">
              I'll help you choose the perfect printing solution for your
              business.
            </p>
          </div>
        </div>
      </div>

      {/* ===========================================
          Assistant Message
      =========================================== */}

      <Section icon={MessageSquare} title="AI Assistant">
        <p className="leading-7 whitespace-pre-wrap text-slate-700">
          {message}
        </p>
      </Section>

      {/* ===========================================
          RECOMMENDATION MODE
      =========================================== */}

      {/* ===========================================
          RECOMMENDATION
      =========================================== */}

      {isRecommendation && (
        <>
          <Section icon={Sparkles} title="AI Recommendation">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Product Image */}

              <div className="bg-slate-100">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={displayProduct.name}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center">
                    <Package className="h-12 w-12 text-slate-300" />
                  </div>
                )}
              </div>

              {/* Product Details */}

              <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    ⭐ AI Recommended
                  </span>

                  {displayProduct.badge && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {displayProduct.badge}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-slate-900">
                  {displayProduct.name}
                </h2>

                {price && (
                  <div className="mt-2 text-2xl font-bold text-green-600">
                    AED {price}
                  </div>
                )}

                {displayProduct.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {displayProduct.description}
                  </p>
                )}

                {recommendation.recommendationReason && (
                  <div className="mt-4 rounded-lg bg-blue-50 p-3">
                    <div className="text-sm font-semibold text-blue-700">
                      💡 Why this recommendation
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {recommendation.recommendationReason}
                    </p>
                  </div>
                )}

                {features.length > 0 && (
                  <div className="mt-5">
                    <h4 className="mb-3 font-semibold text-slate-900">
                      Key Features
                    </h4>

                    <div className="space-y-2">
                      {features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <div className="mt-1 text-green-600">✓</div>

                          <div className="text-sm text-slate-700">
                            {feature}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {availableAddons.length > 0 && (
            <Section icon={Package} title="Available Finishing Options">
              <div className="space-y-3">
                {availableAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="relative rounded-xl border border-slate-200 p-4 bg-white"
                  >
                    {addon.image && (
                      <img
                        src={addon.image}
                        alt={addon.name}
                        className="absolute top-4 right-4 h-16 w-16 rounded-lg object-cover border"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}

                    <div className="pr-20">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{addon.name}</h4>

                        {selectedAddons.some((a) => a.id === addon.id) && (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                            Selected
                          </span>
                        )}
                      </div>

                      {addon.price && (
                        <div className="mt-3">
                          <div className="text-3xl font-bold text-green-600">
                            {addon.price.currency} {addon.price.amount}
                          </div>

                          {addon.price.unit && (
                            <div className="text-sm text-slate-500">
                              {addon.price.unit}
                            </div>
                          )}
                        </div>
                      )}

                      {addon.description && (
                        <p className="mt-4 text-sm text-slate-600">
                          {addon.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {actions.length > 0 && (
            <Section
              icon={ClipboardList}
              title="What would you like to do next?"
            >
              <div className="space-y-3">
                {actions.map((action, index) => (
                  <ActionButton
                    key={`${action.id}-${index}`}
                    action={action}
                    metadata={metadata}
                  />
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ===========================================
          PRODUCT COMPARISON
      =========================================== */}

      {isComparison && (
        <Section icon={Package} title={`Choose Your ${product.name}`}>
          <div className="space-y-5">
            {options.map((option) => {
              const action = actions.find(
                (a) => a.value === option.id || a.label === option.name,
              );

              return (
                <div
                  key={option.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-400 hover:shadow-md"
                >
                  {/* Product Image */}

                  <div className="bg-slate-100">
                    {option.image ? (
                      <img
                        src={option.image}
                        alt={option.name}
                        className="h-52 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center">
                        <Package className="h-14 w-14 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}

                  <div className="p-4">
                    {/* Badge */}

                    <div className="mb-3 flex flex-wrap gap-2">
                      {option.badge && (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {option.badge}
                        </span>
                      )}

                      {recommendation?.id === option.id && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          AI Recommended
                        </span>
                      )}
                    </div>

                    {/* Title */}

                    <h3 className="text-xl font-bold text-slate-900">
                      {option.name}
                    </h3>

                    {/* Price */}

                    {option.startingPrice && (
                      <div className="mt-2 text-2xl font-bold text-green-600">
                        AED {option.startingPrice}
                      </div>
                    )}

                    {/* Description */}

                    {option.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {option.description}
                      </p>
                    )}

                    {/* Features */}

                    {option.features?.length > 0 && (
                      <div className="mt-5 space-y-2">
                        {option.features.slice(0, 4).map((feature) => (
                          <div key={feature} className="flex items-start gap-3">
                            <div className="mt-1 text-green-600">✓</div>

                            <div className="text-sm text-slate-700">
                              {feature}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Button */}

                    {action && (
                      <div className="mt-6">
                        <ActionButton
                          action={action}
                          metadata={metadata}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      {/* ===========================================
          SELECTED VARIANT
      =========================================== */}
      {isSelectedVariant && (
        <Section icon={Package} title="Selected Product">
          {productImage && (
            <img
              src={productImage}
              alt={displayProduct.name}
              className="mb-5 aspect-[16/9] w-full rounded-xl object-cover"
            />
          )}

          <h2 className="text-2xl font-bold">{displayProduct.name}</h2>

          {displayProduct.badge && (
            <div className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {displayProduct.badge}
            </div>
          )}

          {price && (
            <div className="mt-4 text-3xl font-bold text-green-600">
              AED {price}
            </div>
          )}

          {displayProduct.description && (
            <p className="mt-5 leading-7 text-slate-600">
              {displayProduct.description}
            </p>
          )}

          {features.length > 0 && (
            <div className="mt-6">{renderFeatureList(features)}</div>
          )}
        </Section>
      )}

      {/* ===========================================
          ORDER COLLECTION
      =========================================== */}

      {isOrderCollection && (
        <>
          {/* ===========================================
        CURRENT QUESTION
    =========================================== */}

          {(field?.question || requirement?.description) && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                Current Step
              </div>

              <h3 className="text-lg font-semibold text-slate-900">
                {field?.label || requirement?.name}
              </h3>

              <p className="mt-3 leading-7 text-slate-700">
                {field?.question || requirement?.description}
              </p>

              {field?.description && (
                <p className="mt-3 text-sm text-slate-500">
                  {field.description}
                </p>
              )}
            </div>
          )}

          {/* ===========================================
        ADDONS
    =========================================== */}

          {isAddons && availableAddons.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <h3 className="text-xl font-semibold text-slate-900">
                  {addons.label || "Optional Finishing Options"}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Personalize your product with premium finishing options. These
                  are completely optional and you can continue without selecting
                  any.
                </p>
              </div>

              <div className="space-y-5">
                {availableAddons.map((addon) => {
                  const action = actions.find(
                    (a) => a.payload?.addonId === addon.id,
                  );

                  const selected = selectedAddons.some(
                    (item) => item.id === addon.id,
                  );

                  return (
                    <div
                      key={addon.id}
                      className={`rounded-2xl border transition-all duration-200 ${
                        selected
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md"
                      }`}
                    >
                      <div className="relative flex h-full flex-col p-6">
                        {addon.image && (
                          <img
                            src={addon.image}
                            alt={addon.name}
                            className="absolute top-6 right-6 h-20 w-20 rounded-lg border border-slate-200 bg-white object-cover"
                          />
                        )}

                        <div className="pr-24">
                          <h4 className="text-lg font-semibold text-slate-900">
                            {addon.name}
                          </h4>

                          {selected && (
                            <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              ✓ Selected
                            </span>
                          )}

                          {addon.price && (
                            <div className="mt-5">
                              <div className="text-3xl font-bold text-green-600">
                                {addon.price.currency} {addon.price.amount}
                              </div>

                              {addon.price.unit && (
                                <div className="text-sm text-slate-500">
                                  {addon.price.unit}
                                </div>
                              )}
                            </div>
                          )}

                          {addon.description && (
                            <p className="mt-5 text-sm leading-7 text-slate-600">
                              {addon.description}
                            </p>
                          )}
                        </div>

                        {action && (
                          <div className="mt-6">
                            <ActionButton
                              action={action}
                              metadata={metadata}
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                  <div className="flex h-full flex-col p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Continue Without Add-ons
                    </h4>

                    <p className="mt-5 text-sm leading-7 text-slate-600">
                      Finishing options are optional. You can continue without
                      selecting any finishing options.
                    </p>

                    <div className="mt-6">
                      <ActionButton
                        action={{
                          id: "SKIP_ADDONS",
                          label: "Continue Without Add-ons",
                          payload: { skip: true },
                        }}
                        metadata={metadata}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===========================================
        AVAILABLE OPTIONS
    =========================================== */}

          {field?.options?.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-4 font-semibold text-slate-800">
                Available Options
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                {field.options.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="font-medium text-slate-800">
                      {option.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {/* ===========================================
          REVIEW
      =========================================== */}

      {isReview && (
        <>
          <Section icon={Package} title="Order Summary">
            {productImage && (
              <img
                src={productImage}
                alt={displayProduct.name}
                className="mb-6 aspect-[16/9] w-full rounded-xl object-cover"
              />
            )}

            <h2 className="text-2xl font-bold">{displayProduct.name}</h2>

            {displayProduct.badge && (
              <div className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                {displayProduct.badge}
              </div>
            )}

            {price && (
              <div className="mt-4 text-3xl font-bold text-green-600">
                AED {price}
              </div>
            )}

            {displayProduct.description && (
              <p className="mt-5 leading-7 text-slate-600">
                {displayProduct.description}
              </p>
            )}
          </Section>

          {features.length > 0 && (
            <Section icon={ClipboardList} title="Selected Product Features">
              {renderFeatureList(features)}
            </Section>
          )}

          {Object.keys(productData).length > 0 && (
            <Section icon={ClipboardList} title="Product Information">
              {Object.entries(productData).map(([key, value]) => (
                <InfoRow key={key} label={formatLabel(key)} value={value} />
              ))}
            </Section>
          )}

          {selectedAddons.length > 0 && (
            <Section icon={Package} title="Selected Finishing Options">
              <div className="grid gap-4 md:grid-cols-2">
                {selectedAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="rounded-xl border border-green-200 bg-green-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{addon.name}</h4>

                      <span className="text-green-600">✓</span>
                    </div>

                    {addon.description && (
                      <p className="mt-2 text-sm text-slate-600">
                        {addon.description}
                      </p>
                    )}

                    {addon.price && (
                      <div className="mt-3 font-semibold text-green-600">
                        {addon.price.currency} {addon.price.amount}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {Object.keys(workflow).length > 0 && (
            <Section icon={ClipboardList} title="Order Details">
              {Object.entries(workflow).map(([key, value]) => (
                <InfoRow key={key} label={formatLabel(key)} value={value} />
              ))}
            </Section>
          )}

          {Object.keys(order.delivery ?? {}).length > 0 && (
            <Section icon={Truck} title="Delivery Details">
              {Object.entries(order.delivery ?? {}).map(([key, value]) => (
                <InfoRow key={key} label={formatLabel(key)} value={value} />
              ))}
            </Section>
          )}

          {Object.keys(order.customer ?? {}).length > 0 && (
            <Section icon={User} title="Customer Details">
              {Object.entries(order.customer ?? {}).map(([key, value]) => (
                <InfoRow key={key} label={formatLabel(key)} value={value} />
              ))}
            </Section>
          )}

          {Object.keys(order.pricing ?? {}).length > 0 && (
            <Section icon={DollarSign} title="Price Summary">
              {Object.entries(order.pricing ?? {}).map(([key, value]) => (
                <InfoRow key={key} label={formatLabel(key)} value={value} />
              ))}
            </Section>
          )}
        </>
      )}

      {isEdit && (
        <Section icon={ClipboardList} title="Edit Your Order">
          <p className="mb-5">Choose what you'd like to edit.</p>

          <div className="grid gap-3">
            {actions.map((action, index) => (
              <ActionButton key={index} action={action} metadata={metadata} />
            ))}
          </div>
        </Section>
      )}

      {/* ===========================================
          ACTIONS
      =========================================== */}

      {actions.length > 0 &&
        !isRecommendation &&
        !isComparison &&
        !isSelectedVariant &&
        !isCompleted && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {isReview ? "Review & Confirm" : "Next Step"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {isReview
                  ? "Please review your order before submitting."
                  : "Select one of the available options below to continue."}
              </p>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {actions.map((action, index) => (
                  <ActionButton
                    key={`${action.id}-${index}`}
                    action={action}
                    metadata={metadata}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      {/* ===========================================
          FOOTER
      =========================================== */}

      {!isReview && !isCompleted && actions.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>

            <div>
              <div className="font-semibold text-slate-800">
                Waiting for your response
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Continue the conversation by answering the question above.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===========================================
          COMPLETED
      =========================================== */}

      {isCompleted && (
        <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <ClipboardList className="h-6 w-6 text-green-600" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-green-900">
                Order Submitted Successfully
              </h3>

              <p className="mt-3 leading-7 text-green-700">
                Thank you for your order.
                <br />
                Our sales team will review your requirements, prepare the
                quotation and contact you shortly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
