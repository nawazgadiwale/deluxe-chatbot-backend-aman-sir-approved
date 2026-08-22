import fs from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";

export default class TextDocumentLoader {
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
          filename: path.basename(this.filePath),
          extension: path.extname(this.filePath),
        },
      }),
    ];
  }
}
