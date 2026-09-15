import fs from "fs";
import path from "path";

export default class SalesCatalogService {
  constructor() {
    this.catalog = [];
    this.load();
  }

  // Load Catalog

  load() {
    const candidateRoots = [
      path.join(process.cwd(), "ai-bot", "data", "sales-catalog"),
      path.join(process.cwd(), "data", "sales-catalog"),
    ];

    this.catalog = [];
    const seenKeys = new Set();

    for (const root of candidateRoots) {
      if (fs.existsSync(root)) {
        this.readDirectory(root, seenKeys);
      }
    }
  }

  readDirectory(directory, seenKeys = new Set()) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);

      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.readDirectory(filePath, seenKeys);
        continue;
      }

      if (!file.endsWith(".json")) {
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      for (const product of data.products ?? []) {
        const normSlug = product.slug
          ? String(product.slug).trim().toLowerCase()
          : "";
        const normId =
          product.id !== undefined && product.id !== null
            ? String(product.id).trim().toLowerCase()
            : "";
        const categoryPrefix = `${String(data.mainCategory || "").toLowerCase()}:${String(data.subCategory || "").toLowerCase()}`;

        const slugKey = normSlug ? `${categoryPrefix}:slug:${normSlug}` : null;
        const idKey = normId ? `${categoryPrefix}:id:${normId}` : null;
        const nameKey = product.name
          ? `${categoryPrefix}:name:${String(product.name).trim().toLowerCase()}`
          : null;

        if (
          (slugKey && seenKeys.has(slugKey)) ||
          (idKey && seenKeys.has(idKey)) ||
          (nameKey && seenKeys.has(nameKey))
        ) {
          continue;
        }
        if (slugKey) seenKeys.add(slugKey);
        if (idKey) seenKeys.add(idKey);
        if (nameKey) seenKeys.add(nameKey);

        this.catalog.push({
          ...product,
          mainCategory: data.mainCategory,
          subCategory: data.subCategory,
          catalogPath: filePath,
        });
      }
    }
  }

  // Products

  getProducts() {
    return [...this.catalog];
  }

  getFeaturedProducts() {
    return this.catalog.filter((product) => product.featured === true);
  }

  getTopLevelProduct(productId = "") {
    if (productId === undefined || productId === null || productId === "") {
      return null;
    }
    const idStr = String(productId).trim().toLowerCase();
    return (
      this.catalog.find(
        (product) =>
          product.id === productId ||
          String(product.id).toLowerCase() === idStr ||
          product.slug?.toLowerCase() === idStr,
      ) ?? null
    );
  }

  isSelectionOption(id = "") {
    if (!id) return false;
    const idStr = String(id).trim().toLowerCase();
    for (const prod of this.catalog) {
      const options = prod.selection?.options ?? [];
      const matched = options.some(
        (opt) =>
          opt.id === id ||
          String(opt.id).toLowerCase() === idStr ||
          opt.slug?.toLowerCase() === idStr,
      );
      if (matched) return true;
    }
    return false;
  }

  getProduct(productId = "") {
    if (productId === undefined || productId === null || productId === "") {
      return null;
    }

    const idStr = String(productId).trim().toLowerCase();

    // 1. Direct top-level catalog product match
    const topLevel = this.catalog.find(
      (product) =>
        product.id === productId ||
        String(product.id).toLowerCase() === idStr ||
        product.slug?.toLowerCase() === idStr,
    );
    if (topLevel) {
      return topLevel;
    }

    // 2. Search nested products within selection options
    for (const prod of this.catalog) {
      const options = prod.selection?.options ?? [];
      for (const opt of options) {
        if (Array.isArray(opt.products)) {
          const nested = opt.products.find(
            (child) =>
              child.id === productId ||
              String(child.id).toLowerCase() === idStr ||
              child.slug?.toLowerCase() === idStr ||
              child.productId === productId ||
              String(child.productId || "").toLowerCase() === idStr,
          );
          if (nested) {
            return {
              ...prod,
              ...nested,
              id: nested.id,
              productId: nested.id,
              name: nested.name ?? nested.productName ?? prod.name,
              slug: nested.slug ?? nested.id,
              image: nested.image ?? nested.images ?? prod.image,
              images: nested.images ?? nested.image ?? prod.images,
              description: nested.description ?? prod.description,
              badge: nested.badge ?? prod.badge,
              parentProductId: prod.id,
              parentSelectionId: opt.id,
              parentProduct: prod,
              selection: opt,
              catalogPath: prod.catalogPath,
            };
          }
        }
      }
    }

    // 3. Search selection options themselves if referenced as concrete variant
    for (const prod of this.catalog) {
      const options = prod.selection?.options ?? [];
      const matchedOpt = options.find(
        (opt) =>
          opt.id === productId ||
          String(opt.id).toLowerCase() === idStr ||
          opt.slug?.toLowerCase() === idStr,
      );
      if (matchedOpt) {
        return {
          ...prod,
          ...matchedOpt,
          id: matchedOpt.id,
          productId: matchedOpt.id,
          name: matchedOpt.name ?? matchedOpt.label ?? prod.name,
          slug: matchedOpt.slug ?? matchedOpt.id,
          image: matchedOpt.image ?? matchedOpt.images ?? prod.image,
          images: matchedOpt.images ?? matchedOpt.image ?? prod.images,
          description: matchedOpt.description ?? prod.description,
          badge: matchedOpt.badge ?? prod.badge,
          parentProductId: prod.id,
          parentProduct: prod,
          selection: matchedOpt,
          catalogPath: prod.catalogPath,
        };
      }
    }

    return null;
  }

  resolveProduct({ productId, parentProductId, selectionId, slug } = {}) {
    // 1. Scoped lookup when parentProductId is known
    if (parentProductId) {
      const parent = this.getProduct(parentProductId);
      if (parent) {
        const options = parent.selection?.options ?? [];
        if (selectionId) {
          const selection = options.find(
            (o) =>
              o.id === selectionId ||
              String(o.id).toLowerCase() === String(selectionId).toLowerCase(),
          );
          if (selection && Array.isArray(selection.products)) {
            const nested = selection.products.find(
              (p) =>
                (productId &&
                  (p.id === productId ||
                    String(p.id).toLowerCase() ===
                    String(productId).toLowerCase() ||
                    p.slug?.toLowerCase() ===
                    String(productId).toLowerCase())) ||
                (slug && p.slug?.toLowerCase() === String(slug).toLowerCase()),
            );
            if (nested) {
              return {
                ...parent,
                ...nested,
                id: nested.id,
                productId: nested.id,
                name: nested.name ?? parent.name,
                slug: nested.slug ?? nested.id,
                image: nested.image ?? nested.images ?? parent.image,
                images: nested.images ?? nested.image ?? parent.images,
                description: nested.description ?? parent.description,
                badge: nested.badge ?? parent.badge,
                parentProductId: parent.id,
                parentSelectionId: selection.id,
                parentProduct: parent,
                selection,
                catalogPath: parent.catalogPath,
              };
            }
          }
          if (
            selection &&
            (selection.id === productId ||
              String(selection.id).toLowerCase() ===
              String(productId).toLowerCase() ||
              selection.slug === slug)
          ) {
            return {
              ...parent,
              ...selection,
              id: selection.id,
              productId: selection.id,
              name: selection.name ?? selection.label ?? parent.name,
              slug: selection.slug ?? selection.id,
              image: selection.image ?? selection.images ?? parent.image,
              images: selection.images ?? selection.image ?? parent.images,
              description: selection.description ?? parent.description,
              badge: selection.badge ?? parent.badge,
              parentProductId: parent.id,
              parentProduct: parent,
              selection,
              catalogPath: parent.catalogPath,
            };
          }
        }
      }
    }

    // 2. Direct lookup by productId or slug
    const target = productId || slug;
    if (target) {
      return this.getProduct(target);
    }

    return null;
  }

  getProductBySlug(slug = "") {
    if (!slug) {
      return null;
    }

    return this.getProduct(slug);
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

  // Search

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
    const text = this.normalize(message);

    if (!text) {
      return [];
    }

    const tokens = this.tokenize(text);
    const scored = [];

    for (const product of this.catalog) {
      const candidates = [
        product.name,
        product.slug?.replace(/[-_]/g, " "),
        ...(product.aliases ?? []),
        ...(product.synonyms ?? []),
      ]
        .filter(Boolean)
        .map((value) => this.normalize(value))
        .filter(Boolean);


      let bestScore = 0;

      for (const candidate of candidates) {
        const candidateTokens = this.tokenize(candidate);

        /*
         * 1. Exact phrase
         */
        if (text === candidate) {
          bestScore = Math.max(bestScore, 100);
          continue;
        }

        /*
         * 2. Full phrase contained in user message
         *
         * Example:
         * "i want business cards"
         */
        if (text.includes(candidate)) {
          bestScore = Math.max(bestScore, 95);
          continue;
        }

        /*
         * 3. Token-level matching
         */
        const tokenScores = tokens.map((inputToken) => {
          let bestTokenScore = 0;

          for (const candidateToken of candidateTokens) {
            bestTokenScore = Math.max(
              bestTokenScore,
              this.similarity(inputToken, candidateToken),
            );
          }

          return bestTokenScore;
        });

        if (!tokenScores.length) {
          continue;
        }

        const matchedTokens = tokenScores.filter(
          (score) => score >= 0.82,
        );

        if (!matchedTokens.length) {
          continue;
        }

        const averageScore =
          matchedTokens.reduce((sum, score) => sum + score, 0) /
          matchedTokens.length;

        const coverage =
          matchedTokens.length / candidateTokens.length;

        /*
         * Require reasonable candidate coverage.
         *
         * This prevents a single common word from accidentally
         * selecting an unrelated product.
         */
        if (coverage >= 1) {
          bestScore = Math.max(
            bestScore,
            Math.round(60 + averageScore * 35),
          );
        } else if (coverage >= 0.5) {
          bestScore = Math.max(
            bestScore,
            Math.round(50 + averageScore * 30),
          );
        }
      }

      if (bestScore > 0) {
        scored.push({
          product,
          score: bestScore,
        });
      }


    }

    const sorted = scored
      .filter(({ score }) => score >= 70)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.product.name.localeCompare(b.product.name),
      );

    if (
      sorted.length > 1 &&
      sorted[0].score >= 90 &&
      sorted[0].score > sorted[1].score
    ) {
      return [sorted[0].product];
    }

    return sorted.map(({ product }) => product);
  }

  similarity(a = "", b = "") {
    if (!a || !b) {
      return 0;
    }

    if (a === b) {
      return 1;
    }

    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    if (!maxLength) {
      return 1;
    }

    return 1 - distance / maxLength;
  }

  levenshteinDistance(a = "", b = "") {
    const previous = Array.from(
      { length: b.length + 1 },
      (_, index) => index,
    );

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];

      for (let j = 1; j <= b.length; j += 1) {
        const insertion = current[j - 1] + 1;
        const deletion = previous[j] + 1;
        const substitution =
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);

        current.push(
          Math.min(insertion, deletion, substitution),
        );
      }

      previous.splice(0, previous.length, ...current);

    }

    return previous[b.length];
  }


  tokenize(value = "") {
    return this.normalize(value)
      .split(" ")
      .map((token) =>
        token.replace(/(ies|es|s)$/i, (suffix) =>
          suffix === "ies" ? "y" : "",
        ),
      )
      .filter(Boolean);
  }

  findProduct(message = "") {
    const matches = this.findProducts(message);
    return matches.length === 1 ? matches[0] : null;
  }

  findCategoryProducts(message = "") {
    const text = this.normalize(message);
    if (!text) return [];

    const categories = [
      ...this.getMainCategories(),
      ...this.getSubCategories(),
    ].filter(Boolean);

    const matched = categories.find((category) => {
      const normalizedCategory = this.normalize(category);
      return (
        text === normalizedCategory ||
        text.includes(normalizedCategory) ||
        normalizedCategory.includes(text)
      );
    });

    if (!matched) return [];

    return this.getProductsByMainCategory(matched).length
      ? this.getProductsByMainCategory(matched)
      : this.getProductsBySubCategory(matched);
  }

  normalize(value = "") {
    return String(value)
      .toLowerCase()
      .replace(/[-_&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Selection

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
  // Product Fields

  getProductFields(product = {}, item = {}) {
    const parent = product.parentProductId
      ? product.parentProduct ?? this.getProduct(product.parentProductId)
      : null;
    const baseProduct = parent ?? product;
    const selectionId =
      item.selection?.id ||
      item.selectionId ||
      product.parentSelectionId ||
      item.selectedProduct?.parentSelectionId;
    const selection = selectionId
      ? this.getSelectionOption(baseProduct, selectionId)
      : null;

    const candidateSources = [
      baseProduct.fields,
      selection?.fields,
      product.fields,
      item.selectedProduct?.fields,
    ];

    const fieldsMap = new Map();
    for (const source of candidateSources) {
      if (Array.isArray(source)) {
        for (const field of source) {
          if (field && field.id && !fieldsMap.has(field.id)) {
            fieldsMap.set(field.id, field);
          }
        }
      }
    }

    const allFields = Array.from(fieldsMap.values());
    allFields.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    return allFields;
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
    return this.getProductField(product, {}, fieldId) !== null;
  }

  getProductFieldOptions(product = {}, fieldId = "") {
    return this.getProductField(product, {}, fieldId)?.options ?? [];
  }

  getCurrentField(product = {}, item = {}) {
    return (
      this.getProductFields(product, item).find(
        (field) =>
          field.required !== false &&
          !this.isFieldCompleted(item, field),
      ) ?? null
    );
  }

  getNextField(product = {}, item = {}) {
    return this.getCurrentField(product, item);
  }

  hasRemainingFields(product = {}, item = {}) {
    const workflow = this.getProductWorkflow(product);
    if (
      workflow.length > 0 &&
      !workflow.some((s) => s.type === "fields" || s.id === "fields")
    ) {
      return false;
    }
    return this.getCurrentField(product, item) !== null;
  }

  isFieldCompleted(item = {}, field = {}) {
    const fieldId = typeof field === "string" ? field : field?.id;
    if (!fieldId) return false;

    if (
      (typeof field === "object" && field?.mapsTo === "delivery.method") ||
      fieldId === "deliveryMethod" ||
      fieldId === "delivery"
    ) {
      return Boolean(item.delivery?.method);
    }

    const value =
      item.workflow?.[fieldId] ??
      item.productData?.[fieldId] ??
      item.formData?.[fieldId];

    return value !== undefined && value !== null && value !== "";
  }

  // Requirements

  getRequirements(product = {}) {
    if (Array.isArray(product.requirements) && product.requirements.length > 0) {
      return product.requirements;
    }

    if (product.parentProductId) {
      const parent =
        product.parentProduct ?? this.getProduct(product.parentProductId);

      if (parent && Array.isArray(parent.requirements)) {
        return parent.requirements;
      }
    }

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
    if (requirementId === "designRequired" || requirementId === "artwork") {
      if (
        item.artwork?.received === true ||
        item.artwork?.mediaId ||
        item.artworkReceived === true ||
        item.workflow?.artwork === true ||
        item.workflow?.artworkReceived === true ||
        item.workflow?.designRequired === "have_artwork" ||
        item.workflow?.designRequired === "need_design" ||
        item.productData?.designRequired === "need_design" ||
        item.workflow?.artworkSkipped === true ||
        item.workflow?.designRequiredSkipped === true
      ) {
        return true;
      }
    }

    const val =
      this.getWorkflowValue(item, requirementId) ??
      item.workflow?.[requirementId] ??
      item.productData?.[requirementId] ??
      item.formData?.[requirementId];

    if (val !== undefined && val !== null && val !== "") return true;
    if (item.workflow?.[`${requirementId}Skipped`] === true) return true;
    return false;
  }

  getCurrentRequirement(product = {}, item = {}) {
    return (
      this.getRequirements(product).find(
        (requirement) =>
          !this.isRequirementCompleted(item, requirement.id),
      ) ?? null
    );
  }

  getNextRequirement(product = {}, item = {}) {
    return this.getCurrentRequirement(product, item);
  }

  hasRemainingRequirements(product = {}, item = {}) {
    const workflow = this.getProductWorkflow(product);
    if (
      workflow.length > 0 &&
      !workflow.some(
        (s) =>
          s.type === "requirements" ||
          s.type === "requirement" ||
          s.id === "requirements" ||
          s.id === "requirement",
      )
    ) {
      return false;
    }
    return this.getCurrentRequirement(product, item) !== null;
  }

  // Product Workflow

  getProductWorkflow(product = {}) {
    let rawWorkflow = [];
    if (Array.isArray(product.workflow) && product.workflow.length > 0) {
      rawWorkflow = product.workflow;
    } else if (product.parentProductId) {
      const parent =
        product.parentProduct ?? this.getProduct(product.parentProductId);

      if (parent && Array.isArray(parent.workflow)) {
        rawWorkflow = parent.workflow;
      }
    }

    const normalized = rawWorkflow.map((step, index) => {
      if (typeof step === "string") {
        return {
          id: step,
          type: step,
          required: true,
          order: index + 1,
        };
      }
      return {
        id: step.id ?? step.type,
        type: step.type ?? step.id,
        required: step.required !== false,
        order: step.order !== undefined ? step.order : index + 1,
        ...step,
      };
    });

    normalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return normalized;
  }

  // Workflow Data

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

  // Selection Context

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
  // Product Context

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

  // Categories

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

  // Pricing

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

  // Features

  getFeatures(product = {}) {
    return product.features ?? [];
  }

  hasFeatures(product = {}) {
    return this.getFeatures(product).length > 0;
  }

  // Addons

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

  // Production

  getProduction(product = {}) {
    return product.production ?? {};
  }

  // Recommendation

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

  // Validation

  isValidProduct(productId = "") {
    return this.getProduct(productId) !== null;
  }

  isValidSelection(product = {}, optionId = "") {
    return this.getSelectionOption(product, optionId) !== null;
  }

  isProductReady(product = {}) {
    return !!(product.id && product.name);
  }

  // Utilities

  refresh() {
    this.load();
  }

  count() {
    return this.catalog.length;
  }

  isEmpty() {
    return this.catalog.length === 0;
  }


  // Workflow Engine

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
    const stepType = this.getWorkflowStepType(step);
    switch (stepType) {
      case "selection":
        return Boolean(
          item.selection?.id ||
          item.selectedProduct?.id ||
          product.parentProductId ||
          product.parentSelectionId ||
          !product.selection?.options?.length,
        );

      case "fields":
        return !this.hasRemainingFields(product, item);

      case "requirements":
      case "requirement":
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

      case "artwork":
        return Boolean(
          item.artwork?.received === true ||
          item.artwork?.mediaId ||
          item.artworkReceived === true ||
          item.workflow?.artwork === true ||
          item.workflow?.artworkReceived === true ||
          item.workflow?.designRequired === "need_design" ||
          item.productData?.designRequired === "need_design" ||
          item.workflow?.artworkSkipped === true ||
          (step?.required === false && item.workflow?.artworkSkipped === true),
        );

      case "delivery":
      case "deliveryMethod": {
        const method = item.delivery?.method ?? null;
        if (!method) return false;
        if (String(method).toLowerCase() === "delivery") {
          const addr = item.delivery?.address ?? null;
          return Boolean(addr && (typeof addr === "string" ? addr.trim().length > 0 : Object.keys(addr).length > 0));
        }
        return true;
      }

      case "delivery_date":
      case "deliveryDate":
        return Boolean(
          item.delivery?.requiredDate ??
          item.workflow?.deliveryDate ??
          item.productData?.deliveryDate,
        );

      case "quotation":
        return Boolean(
          item.quotation?.accepted === true ||
          item.workflow?.quotationAccepted === true ||
          item.quotationAccepted === true ||
          step?.required === false,
        );

      case "confirmation":
        return Boolean(item.confirmed || item.orderConfirmed || item.workflow?.confirmed === true);

      case "production":
        return Boolean(
          item.production?.confirmed === true ||
          item.workflow?.productionConfirmed === true ||
          step?.required === false,
        );

      case "dispatch":
        return Boolean(
          item.dispatch?.confirmed === true ||
          item.workflow?.dispatchConfirmed === true ||
          step?.required === false,
        );

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


  //  Discovery


  discover(message = "") {
    const text = this.normalize(message);
    if (!text) return [];

    const exact = this.findProducts(text);
    if (exact.length === 1) return exact;
    if (exact.length > 1) return exact;

    const categoryProducts = this.findCategoryProducts(text);
    if (categoryProducts.length) return categoryProducts;

    return this.search(text);
  }
}
