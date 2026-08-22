import fs from "node:fs/promises";
import { Document } from "@langchain/core/documents";

export default class MarkdownDocumentLoader {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    const content = await fs.readFile(this.filePath, "utf8");

    return [
      new Document({
        pageContent: content,
        metadata: {
          source: this.filePath,
        },
      }),
    ];
  }
}
