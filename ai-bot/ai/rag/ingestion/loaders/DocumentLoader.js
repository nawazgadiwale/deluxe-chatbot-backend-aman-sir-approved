// import fs from "node:fs/promises";
// import path from "node:path";

// import PDFDocumentLoader from "./PDFDocumentLoader.js";
// import TextDocumentLoader from "./TextDocumentLoader.js";
// import MarkdownDocumentLoader from "./MarkdownDocumentLoader.js";
// import WordDocumentLoader from "./WordDocumentLoader.js";
// import WebsiteLoader from "./WebsiteLoader.js";

// export default class DocumentLoader {
//   async loadDirectory(directory, rootDirectory = directory) {
//     const documents = [];

//     const files = await fs.readdir(directory);

//     for (const file of files) {
//       const filePath = path.join(directory, file);

//       const stats = await fs.stat(filePath);

//       if (stats.isDirectory()) {
//         const nestedDocuments = await this.loadDirectory(
//           filePath,
//           rootDirectory,
//         );

//         documents.push(...nestedDocuments);

//         continue;
//       }

//       const extension = path.extname(file).toLowerCase();

//       let loader = null;

//       switch (extension) {
//         case ".txt":
//           loader = new TextDocumentLoader(filePath);
//           break;

//         case ".md":
//           loader = new MarkdownDocumentLoader(filePath);
//           break;

//         case ".pdf":
//           loader = new PDFDocumentLoader(filePath);
//           break;

//         case ".docx":
//           loader = new WordDocumentLoader(filePath);
//           break;

//         case ".html":
//           loader =  new WebsiteLoader(filePath);
//           break;

//         default:
//           continue;
//       }

//       const loaded = await loader.load();

//       const relativePath = path.relative(rootDirectory, filePath);

//       const category = relativePath.split(path.sep)[0];

//       loaded.forEach((document) => {
//         document.metadata = {
//           ...(document.metadata ?? {}),

//           source: filePath,

//           relativePath,

//           category,

//           filename: path.basename(file),

//           extension,

//           directory: path.dirname(relativePath),

//           loader: loader.constructor.name,
//         };
//       });

//       documents.push(...loaded);
//     }

//     return documents;
//   }
// }

import fs from "node:fs/promises";
import path from "node:path";

import CatalogLoader from "./CatalogLoader.js";
import PDFDocumentLoader from "./PDFLoader.js";
import TextDocumentLoader from "./TextDocumentLoader.js";
import MarkdownDocumentLoader from "./MarkdownDocumentLoader.js";
import WordDocumentLoader from "./WordDocumentLoader.js";
import WebsiteLoader from "./WebsiteLoader.js";

export default class DocumentLoader {
  async loadDirectory(directory, rootDirectory = directory) {
    const documents = [];

    const entries = await fs.readdir(directory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        documents.push(...(await this.loadDirectory(fullPath, rootDirectory)));
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      let loader = null;

      switch (extension) {
        case ".json":
          loader = new CatalogLoader(fullPath);
          break;

        case ".pdf":
          loader = new PDFDocumentLoader(fullPath);
          break;

        case ".docx":
          loader = new WordDocumentLoader(fullPath);
          break;

        case ".md":
          loader = new MarkdownDocumentLoader(fullPath);
          break;

        case ".txt": {
          const relativePath = path.relative(rootDirectory, fullPath);
          const folder = relativePath.split(path.sep)[0].toLowerCase();

          if (
            folder === "companywebsite" &&
            entry.name.toLowerCase() === "page.txt"
          ) {
            loader = new WebsiteLoader(fullPath);
          } else {
            loader = new TextDocumentLoader(fullPath);
          }

          break;
        }

        default:
          continue;
      }

      if (!loader) continue;
      console.log("--------------------------------");
      console.log("Loading:", fullPath);
      console.log("Loader :", loader.constructor.name);
      console.log("--------------------------------");
      const loaded = await loader.load();
      console.log(`Loaded ${loaded.length} document(s)\n`);
      const relativePath = path.relative(rootDirectory, fullPath);

      const category = relativePath.split(path.sep)[0];

      loaded.forEach((doc) => {
        doc.metadata = {
          ...(doc.metadata ?? {}),

          localSource: fullPath,

          relativePath,

          filename: entry.name,

          extension,

          directory: path.dirname(relativePath),

          category: doc.metadata?.category ?? category,

          loader: doc.metadata?.loader ?? loader.constructor.name,
        };
      });

      documents.push(...loaded);
    }

    return documents;
  }
}
