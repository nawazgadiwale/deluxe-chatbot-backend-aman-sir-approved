import fs from "node:fs/promises";
import path from "node:path";

import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

import { Document } from "@langchain/core/documents";

export default class WebsiteLoader {
  constructor(filePath) {
    this.filePath = filePath;
    this.limit = pLimit(5); // Max 5 concurrent requests
  }

  async load() {
    const file = await fs.readFile(path.resolve(this.filePath), "utf8");

    const urls = file
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url) => !url.startsWith("#"));

    const pages = await Promise.allSettled(
      urls.map((url) => this.limit(() => this.scrapePage(url))),
    );

    const documents = [];

    for (const page of pages) {
      if (page.status === "fulfilled") {
        documents.push(...page.value);
      } else {
        console.error(page.reason);
      }
    }

    return documents;
  }

  async scrapePage(url) {
    console.log("Scraping:", url);

    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 ChatGPT RAG Bot",
      },
    });

    const html = response.data;

    const $ = cheerio.load(html);

    // Remove junk
    $("script,style,noscript,svg,header,footer,nav,aside,iframe,form").remove();

    $(".cookie").remove();
    $(".popup").remove();
    $(".modal").remove();

    const title = $("title").text().trim();

    const description = $('meta[name="description"]').attr("content") ?? "";

    const documents = [];

    let currentHeading = title;

    let buffer = "";

    $("body")
      .children()
      .each((_, element) => {
        const tag = element.tagName?.toLowerCase();

        if (tag === "h1" || tag === "h2") {
          if (buffer.trim()) {
            documents.push(
              new Document({
                pageContent: `Title: ${title}

Section: ${currentHeading}

Description:
${description}

${buffer.trim()}`,
                metadata: {
                  source: url,
                  url,
                  title,
                  description,
                  section: currentHeading,
                  pageType: "website",
                  loader: "WebsiteLoader",
                },
              }),
            );
          }

          currentHeading = $(element).text().trim();

          buffer = "";

          return;
        }

        const text = $(element).text().trim();

        if (text.length > 30) {
          buffer += text + "\n\n";
        }
      });

    if (buffer.trim()) {
      documents.push(
        new Document({
          pageContent: `Title: ${title}

Section: ${currentHeading}

Description:
${description}

${buffer.trim()}`,
          metadata: {
            source: url,
            url,
            title,
            description,
            section: currentHeading,
            pageType: "website",
            loader: "WebsiteLoader",
          },
        }),
      );
    }

    console.log(`${url} -> ${documents.length} sections`);

    return documents;
  }
}
