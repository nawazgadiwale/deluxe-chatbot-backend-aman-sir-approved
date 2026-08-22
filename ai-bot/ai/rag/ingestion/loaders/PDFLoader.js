import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
export default class PDFDocumentLoader {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    const loader = new PDFLoader(this.filePath);

    return loader.load();
  }
}
