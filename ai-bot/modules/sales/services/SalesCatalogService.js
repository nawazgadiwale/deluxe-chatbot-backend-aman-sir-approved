import fs from "fs";
import path from "path";

export default class SalesCatalogService {
  constructor() {
    this.catalog = [];
    this.load();
  }

  /*
   * =====================================================
   * Load Catalog
   * =====================================================
   */

  load() {
    const root = path.join(process.cwd(), "data", "sales-catalog");

    this.catalog = [];

    this.readDirectory(root);

    // console.log("========== CATALOG ==========");
    // console.log("Catalog Size:", this.catalog.length);

    this.catalog.forEach((product) => {
      // console.log(product.id, "=>", product.name);
    });
  }

  readDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);

      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.readDirectory(filePath);
        continue;
      }

      if (!file.endsWith(".json")) {
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      for (const product of data.products ?? []) {
        this.catalog.push({
          ...product,

          mainCategory: data.mainCategory,

          subCategory: data.subCategory,
        });
      }
    }
  }

  /*
   * =====================================================
   * Products
   * =====================================================
   */

  getProducts() {
    return [...this.catalog];
  }

  getFeaturedProducts() {
    return this.catalog.filter((product) => product.featured === true);
  }

  getProduct(productId = "") {
    if (!productId) {
      return null;
    }

    return this.catalog.find((product) => product.id === productId) ?? null;
  }

  getProductBySlug(slug = "") {
    if (!slug) {
      return null;
    }

    const value = slug.toLowerCase();

    return (
      this.catalog.find((product) => product.slug?.toLowerCase() === value) ??
      null
    );
  }

  getProductByName(name = "") {
    if (!name) {
      return null;
    }

    const value = name.toLowerCase();

    return (
      this.catalog.find((product) => product.name?.toLowerCase() === value) ??
      null
    );
  }

  hasProduct(productId = "") {
    return this.getProduct(productId) !== null;
  }

  hasProductSlug(slug = "") {
    return this.getProductBySlug(slug) !== null;
  }

  hasProductName(name = "") {
    return this.getProductByName(name) !== null;
  }

  /*
   * =====================================================
   * Search
   * =====================================================
   */

  search(keyword = "") {
    const text = keyword.trim().toLowerCase();

    if (!text) {
      return [];
    }

    return this.catalog.filter((product) => {
      return (
        product.name?.toLowerCase().includes(text) ||
        product.slug?.toLowerCase().includes(text) ||
        (product.description ?? "").toLowerCase().includes(text) ||
        (product.aliases ?? []).some((alias) =>
          alias.toLowerCase().includes(text),
        )
      );
    });
  }

  findProducts(message = "") {
    const text = message.trim().toLowerCase();

    if (!text) {
      return [];
    }

    return this.catalog.filter((product) => {
      if (text.includes(product.name?.toLowerCase())) {
        return true;
      }

      if (
        product.slug &&
        (text.includes(product.slug.toLowerCase()) ||
          text.includes(product.slug.toLowerCase().replace(/-/g, " ")))
      ) {
        return true;
      }

      if (
        (product.aliases ?? []).some((alias) =>
          text.includes(alias.toLowerCase()),
        )
      ) {
        return true;
      }

      if (this.findSelectionOption(product, text)) {
        return true;
      }

      return false;
    });
  }

  findProduct(message = "") {
    return this.findProducts(message)[0] ?? null;
  }

  /*
   * =====================================================
   * Selection
   * =====================================================
   */

  hasSelection(product = {}) {
    return !!product.selection;
  }

  getSelection(product = {}) {
    return product.selection ?? null;
  }

  getSelectionOptions(product = {}) {
    return this.getSelection(product)?.options ?? [];
  }

  getSelectionOption(product = {}, optionId = "") {
    if (!optionId) {
      return null;
    }

    return (
      this.getSelectionOptions(product).find(
        (option) => option.id === optionId,
      ) ?? null
    );
  }

  getSelectionOptionByName(product = {}, name = "") {
    if (!name) {
      return null;
    }

    const value = name.toLowerCase();

    return (
      this.getSelectionOptions(product).find(
        (option) => option.name?.toLowerCase() === value,
      ) ?? null
    );
  }

  hasSelectionOption(product = {}, optionId = "") {
    return this.getSelectionOption(product, optionId) !== null;
  }

  getRecommendedSelection(product = {}) {
    const selection = this.getSelection(product);

    if (!selection) {
      return null;
    }

    const options = this.getSelectionOptions(product);

    if (!options.length) {
      return null;
    }

    return (
      options.find((option) => option.isDefault === true) ??
      options.find((option) => option.featured === true) ??
      (selection.recommended
        ? this.getSelectionOption(product, selection.recommended)
        : null) ??
      options[0]
    );
  }

  getAlternativeSelections(product = {}, selectedId = "") {
    return this.getSelectionOptions(product).filter(
      (option) => option.id !== selectedId,
    );
  }

  findSelectionOption(product = {}, message = "") {
    const text = message.trim().toLowerCase();

    if (!text) {
      return null;
    }

    return (
      this.getSelectionOptions(product).find((option) => {
        if (text.includes(option.name.toLowerCase())) {
          return true;
        }

        if (
          option.id &&
          text.includes(option.id.toLowerCase().replace(/-/g, " "))
        ) {
          return true;
        }

        if (
          (option.aliases ?? []).some((alias) =>
            text.includes(alias.toLowerCase()),
          )
        ) {
          return true;
        }

        return false;
      }) ?? null
    );
  }
  /*
   * =====================================================
   * Product Fields
   * =====================================================
   */

  getProductFields(product = {}, item = {}) {
    const selection = this.getSelectionOption(product, item.selection?.id);

    return selection?.fields ?? product.fields ?? [];
  }

  getProductField(product = {}, item = {}, fieldId = "") {
    if (!fieldId) {
      return null;
    }

    return (
      this.getProductFields(product, item).find(
        (field) => field.id === fieldId,
      ) ?? null
    );
  }

  hasProductField(product = {}, fieldId = "") {
    return this.getProductField(product, fieldId) !== null;
  }

  getProductFieldOptions(product = {}, fieldId = "") {
    return this.getProductField(product, fieldId)?.options ?? [];
  }

  getCurrentField(product = {}, item = {}) {
    return (
      this.getProductFields(product, item).find(
        (field) =>
          field.required !== false && item.productData?.[field.id] == null,
      ) ?? null
    );
  }

  getNextField(product = {}, item = {}) {
    return this.getCurrentField(product, item);
  }

  hasRemainingFields(product = {}, item = {}) {
    return this.getCurrentField(product, item) !== null;
  }

  isFieldCompleted(item = {}, fieldId = "") {
    return this.hasWorkflowValue(item, fieldId);
  }

  /*
   * =====================================================
   * Requirements
   * =====================================================
   */

  getRequirements(product = {}) {
    return product.requirements ?? [];
  }

  getRequirement(product = {}, requirementId = "") {
    if (!requirementId) {
      return null;
    }

    return (
      this.getRequirements(product).find(
        (requirement) => requirement.id === requirementId,
      ) ?? null
    );
  }

  hasRequirements(product = {}) {
    return this.getRequirements(product).length > 0;
  }

  hasRequirement(product = {}, requirementId = "") {
    return this.getRequirement(product, requirementId) !== null;
  }

  getRequirementValue(item = {}, requirementId = "") {
    return this.getWorkflowValue(item, requirementId);
  }

  isRequirementCompleted(item = {}, requirementId = "") {
    return this.hasWorkflowValue(item, requirementId);
  }

  getCurrentRequirement(product = {}, item = {}) {
    return (
      this.getRequirements(product).find(
        (requirement) =>
          requirement.required !== false &&
          !this.hasWorkflowValue(item, requirement.id),
      ) ?? null
    );
  }

  getNextRequirement(product = {}, item = {}) {
    return this.getCurrentRequirement(product, item);
  }

  hasRemainingRequirements(product = {}, item = {}) {
    return this.getCurrentRequirement(product, item) !== null;
  }

  /*
   * =====================================================
   * Product Workflow
   * =====================================================
   */

  getProductWorkflow(product = {}) {
    return Array.isArray(product.workflow) ? product.workflow : [];
  }

  /*
   * =====================================================
   * Workflow Data
   * =====================================================
   */

  getWorkflowData(item = {}) {
    return item.workflow ?? {};
  }

  getWorkflowValue(item = {}, key = "") {
    return this.getWorkflowData(item)?.[key];
  }

  setWorkflowValue(item = {}, key = "", value = null) {
    return {
      ...item,
      workflow: {
        ...(item.workflow ?? {}),
        [key]: value,
      },
    };
  }

  hasWorkflow(product = {}) {
    return this.getProductWorkflow(product).length > 0;
  }

  hasWorkflowValue(item = {}, key = "") {
    const value = this.getWorkflowValue(item, key);

    return value !== undefined && value !== null;
  }

  /*
   * =====================================================
   * Selection Context
   * =====================================================
   */

  getSelectionContext(product = {}, selectedId = null) {
    const recommended = this.getRecommendedSelection(product);

    return {
      configuration: this.getSelection(product),

      selected: selectedId
        ? this.getSelectionOption(product, selectedId)
        : null,

      recommended,

      alternatives: this.getAlternativeSelections(
        product,
        selectedId ?? recommended?.id,
      ),
    };
  }
  /*
   * =====================================================
   * Product Context
   * =====================================================
   */
  getProductContext(product = {}, selectedId = null, item = {}) {
    const selected = this.getSelectionOption(product, selectedId);

    return {
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,

        image: selected?.image ?? product.image ?? null,

        images: selected?.images ?? product.images ?? [],

        thumbnail: selected?.thumbnail ?? product.thumbnail ?? null,

        shortDescription:
          product.shortDescription ?? product.description ?? null,
      },

      workflow: this.getProductWorkflow(product),

      selection: this.getSelectionContext(product, selectedId),

      fields: this.getProductFields(product, item),

      requirements: this.getRequirements(product),

      addons: this.getAddons(product),

      features: this.getFeatures(product),

      pricing: this.getPricing(product),

      production: this.getProduction(product),
    };
  }

  /*
   * =====================================================
   * Categories
   * =====================================================
   */

  getMainCategories() {
    return [...new Set(this.catalog.map((product) => product.mainCategory))];
  }

  getSubCategories(mainCategory = "") {
    return [
      ...new Set(
        this.catalog
          .filter((product) =>
            !mainCategory ? true : product.mainCategory === mainCategory,
          )
          .map((product) => product.subCategory),
      ),
    ];
  }

  getProductsByMainCategory(category = "") {
    if (!category) {
      return [];
    }

    return this.catalog.filter((product) => product.mainCategory === category);
  }

  getProductsBySubCategory(category = "") {
    if (!category) {
      return [];
    }

    return this.catalog.filter((product) => product.subCategory === category);
  }

  /*
   * =====================================================
   * Pricing
   * =====================================================
   */

  getPricing(product = {}) {
    return product.pricing ?? {};
  }

  hasPricing(product = {}) {
    return !!product.pricing;
  }

  getCurrency(product = {}) {
    return product.pricing?.currency ?? "AED";
  }

  isQuotationRequired(product = {}) {
    return product.pricing?.quotationRequired === true;
  }

  /*
   * =====================================================
   * Features
   * =====================================================
   */

  getFeatures(product = {}) {
    return product.features ?? [];
  }

  hasFeatures(product = {}) {
    return this.getFeatures(product).length > 0;
  }

  /*
   * =====================================================
   * Addons
   * =====================================================
   */

  getAddons(product = {}) {
    return product.addons ?? [];
  }

  getAddon(product = {}, addonId = "") {
    if (!addonId) {
      return null;
    }

    return (
      this.getAddons(product).options?.find((addon) => addon.id === addonId) ??
      null
    );
  }

  hasAddon(product = {}, addonId = "") {
    return this.getAddon(product, addonId) !== null;
  }

  /*
   * =====================================================
   * Production
   * =====================================================
   */

  getProduction(product = {}) {
    return product.production ?? {};
  }

  /*
   * =====================================================
   * Recommendation
   * =====================================================
   */

  getRecommendationReason(product = {}, option = {}) {
    if (!option) return "";

    switch ((option.badge || "").toLowerCase()) {
      case "best seller":
        return "This is our best-selling option and the most popular choice among businesses.";

      case "recommended":
        return "This is our recommended option for customers looking for a premium appearance.";

      case "premium":
        return "This option offers premium materials and finishes.";

      case "luxury":
        return "This option is designed for customers looking for a luxury presentation.";

      case "signature":
        return "This is our highest-end premium offering.";

      default:
        return "This is a great choice for most customers.";
    }
  }

  getRecommendationContext(product = {}) {
    const recommendation = this.getRecommendedSelection(product);

    return {
      recommendation,

      recommendationReason: this.getRecommendationReason(
        product,
        recommendation,
      ),

      alternatives: this.getAlternativeSelections(product, recommendation?.id),
    };
  }

  /*
   * =====================================================
   * Validation
   * =====================================================
   */

  isValidProduct(productId = "") {
    return this.getProduct(productId) !== null;
  }

  isValidSelection(product = {}, optionId = "") {
    return this.getSelectionOption(product, optionId) !== null;
  }

  isProductReady(product = {}) {
    return !!(product.id && product.name);
  }

  /*
   * =====================================================
   * Utilities
   * =====================================================
   */

  refresh() {
    this.load();
  }

  count() {
    return this.catalog.length;
  }

  isEmpty() {
    return this.catalog.length === 0;
  }

  /*
   * =====================================================
   * Workflow Engine
   * =====================================================
   */

  getCurrentWorkflowStep(product = {}, item = {}) {
    for (const step of this.getProductWorkflow(product)) {
      if (!this.isWorkflowStepCompleted(product, item, step)) {
        return step;
      }
    }

    return null;
  }

  hasRemainingWorkflowSteps(product = {}, item = {}) {
    return !this.isWorkflowCompleted(product, item);
  }

  getNextWorkflowStep(product = {}, item = {}) {
    return this.getCurrentWorkflowStep(product, item);
  }

  getWorkflowStepType(step = null) {
    if (!step) {
      return null;
    }

    if (typeof step === "string") {
      return step;
    }

    return step.type ?? step.id ?? null;
  }

  getWorkflowStep(product = {}, stepId = "") {
    return (
      this.getProductWorkflow(product).find((step) => {
        return this.getWorkflowStepType(step) === stepId;
      }) ?? null
    );
  }

  isWorkflowStepCompleted(product = {}, item = {}, step = null) {
    switch (this.getWorkflowStepType(step)) {
      case "selection":
        return !!item.selection?.id;

      case "fields":
        return !this.hasRemainingFields(product, item);

      case "requirements":
        return !this.hasRemainingRequirements(product, item);

      case "addons": {
        const addons = this.getAddons(product);

        if (
          !addons?.enabled ||
          !Array.isArray(addons.options) ||
          addons.options.length === 0
        ) {
          return true;
        }

        return item.addons?.completed === true;
      }

      default:
        return true;
    }
  }

  isWorkflowCompleted(product = {}, item = {}) {
    return this.getCurrentWorkflowStep(product, item) === null;
  }

  getRelatedProducts(product = {}) {
    if (!Array.isArray(product.relatedProducts)) {
      return [];
    }

    return product.relatedProducts
      .map((id) => this.getProduct(id))
      .filter(Boolean)
      .map((product) => this.toProductSummary(product));
  }

  getSimilarProducts(product = {}) {
    if (!Array.isArray(product.similarProducts)) {
      return [];
    }

    return product.similarProducts
      .map((id) => this.getProduct(id))
      .filter(Boolean)
      .map((product) => this.toProductSummary(product));
  }

  getFrequentlyBoughtTogether(product = {}) {
    if (!Array.isArray(product.frequentlyBoughtWith)) {
      return [];
    }

    return product.frequentlyBoughtWith
      .map((id) => this.getProduct(id))
      .filter(Boolean)
      .map((product) => this.toProductSummary(product));
  }

  toProductSummary(product = {}) {
    const recommendation = this.getRecommendedSelection(product);

    return {
      id: product.id,

      name: product.name,

      slug: product.slug,

      image: recommendation?.image ?? product.image ?? null,

      thumbnail: recommendation?.thumbnail ?? product.thumbnail ?? null,

      badge: recommendation?.badge ?? product.badge ?? null,

      shortDescription: product.shortDescription ?? product.description ?? null,

      pricing: this.getPricing(product),

      featured: product.featured ?? false,
    };
  }

  /*
   * =====================================================
   * Discovery
   * =====================================================
   */

  discover(message = "") {
    const text = message.trim().toLowerCase();

    if (!text) {
      return [];
    }

    // 1. Exact product match
    const exact = this.findProducts(text);

    if (exact.length) {
      return exact;
    }

    // 2. Main category match
    const mainCategory = this.getMainCategories().find((category) =>
      text.includes(category.toLowerCase()),
    );

    if (mainCategory) {
      return this.getProductsByMainCategory(mainCategory);
    }

    // 3. Sub category match
    const subCategory = this.getSubCategories().find((category) =>
      text.includes(category.toLowerCase()),
    );

    if (subCategory) {
      return this.getProductsBySubCategory(subCategory);
    }

    // 4. Fallback keyword search
    return this.search(text);
  }
}
