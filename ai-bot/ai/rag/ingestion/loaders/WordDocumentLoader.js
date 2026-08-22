import fs from "node:fs/promises";
import mammoth from "mammoth";
import { Document } from "@langchain/core/documents";

export default class WordDocumentLoader {
    constructor(filePath) {
        this.filePath = filePath;
    }

    async load() {

        const buffer =
            await fs.readFile(this.filePath);

        const result =
            await mammoth.extractRawText({
                buffer,
            });

        return [
            new Document({
                pageContent: result.value,
                metadata: {
                    source: this.filePath,
                },
            }),
        ];
    }
}