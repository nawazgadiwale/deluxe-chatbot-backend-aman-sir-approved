export default class VariantResolver {
  resolve(product = {}, message = "") {
    if (!product || !message.trim()) {
      return null;
    }

    const text = message.toLowerCase();

    const selection = product.selection;

    if (!selection) {
      return null;
    }

    for (const option of selection.options ?? []) {
      if (this.matches(text, option)) {
        return option;
      }
    }

    return null;
  }

  getSelected(product = {}, selectionId = null) {
    if (!product || !selectionId) {
      return null;
    }

    return (
      product.selection?.options?.find((option) => option.id === selectionId) ??
      null
    );
  }

  isRequired(product = {}) {
    return (product.selection?.options?.length ?? 0) > 1;
  }

  isCompleted(product = {}, selection = null) {
    if (!this.isRequired(product)) {
      return true;
    }

    return selection != null;
  }

  matches(message = "", option = {}) {
    const keywords = [option.name, ...(option.aliases ?? [])]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    return keywords.some((keyword) => message.includes(keyword));
  }
}
