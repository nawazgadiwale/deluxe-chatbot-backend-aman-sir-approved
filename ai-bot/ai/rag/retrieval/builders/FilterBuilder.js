// export default class FilterBuilder {
//   build(input = {}) {
//     const entities = input.entities ?? input;

//     const filter = {};

//     this.add(filter, "mainCategory", entities.mainCategory);
//     this.add(filter, "subCategory", entities.subCategory);
//     this.add(filter, "product", entities.product);
//     this.add(filter, "businessType", entities.businessType);
//     this.add(filter, "department", entities.department);
//     this.add(filter, "language", entities.language);

//     // Always ignore inactive knowledge
//     filter.isActive = true;

//     return filter;
//   }

//   add(filter, key, value) {
//     if (value !== undefined && value !== null && value !== "") {
//       filter[key] = value;
//     }
//   }
// }

// new filter builder

export default class FilterBuilder {
  build(input = {}) {
    const entities = input.entities ?? input;

    const filter = {};

    /*
     * ==========================================
     * Product Hierarchy
     * ==========================================
     */

    this.add(filter, "mainCategory", entities.mainCategory);

    this.add(filter, "subCategory", entities.subCategory);

    this.add(filter, "product", entities.product);

    /*
     * ==========================================
     * Business
     * ==========================================
     */

    this.add(filter, "businessType", entities.businessType);

    this.add(filter, "department", entities.department);

    this.add(filter, "language", entities.language);

    /*
     * ==========================================
     * Rich Catalog Metadata
     * (Used only when available)
     * ==========================================
     */

    this.addArray(filter, "industries", entities.industries);

    this.addArray(filter, "customerGoals", entities.customerGoals);

    this.addArray(filter, "useCases", entities.useCases);

    this.addArray(filter, "keywords", entities.keywords);

    this.addArray(filter, "tags", entities.tags);

    /*
     * ==========================================
     * Always ignore inactive knowledge
     * ==========================================
     */

    filter.isActive = true;

    return filter;
  }

  add(filter, key, value) {
    if (value !== undefined && value !== null && value !== "") {
      filter[key] = value;
    }
  }

  addArray(filter, key, value) {
    if (Array.isArray(value) && value.length > 0) {
      filter[key] = value;
    }
  }
}
