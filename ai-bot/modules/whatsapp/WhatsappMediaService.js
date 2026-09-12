import fs from "fs";
import path from "path";
import crypto from "crypto";
import WhatsAppApiService from "./services/WhatsAppApiService.js";

export default class WhatsAppMediaService {
  constructor(apiService = null) {
    this.apiService = apiService || new WhatsAppApiService();

    this.uploadDirectory =
      process.env.WHATSAPP_MEDIA_DIR ||
      path.join(process.cwd(), "storage", "whatsapp");
  }

  async getMedia(mediaId) {
    return this.apiService.getMediaMetadata(mediaId);
  }

  async downloadMedia(mediaUrl) {
    return this.apiService.downloadMedia(mediaUrl);
  }

  async downloadMediaById(mediaId) {
    const metadata = await this.getMedia(mediaId);

    if (!metadata?.url) {
      throw new Error("WhatsApp media metadata does not contain a URL.");
    }

    const buffer = await this.downloadMedia(metadata.url);

    return {
      mediaId,
      mimeType: metadata.mime_type ?? null,
      sha256: metadata.sha256 ?? null,
      fileSize: buffer.length,
      buffer,
      metadata,
    };
  }

  extensionFromMimeType(mimeType, fallback = "bin") {
    const map = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",

      "application/pdf": "pdf",

      "application/msword": "doc",

      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",

      "text/plain": "txt",

      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/wav": "wav",

      "video/mp4": "mp4",
      "video/3gpp": "3gp",
    };

    return map[mimeType] ?? fallback;
  }

  sanitizeFilename(filename) {
    if (!filename) {
      return null;
    }

    return String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 200);
  }

  async saveBuffer({ buffer, mediaId, mimeType = null, filename = null } = {}) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Media buffer is required.");
    }

    if (!mediaId) {
      throw new Error("mediaId is required.");
    }

    await fs.promises.mkdir(this.uploadDirectory, {
      recursive: true,
    });

    const extension = this.extensionFromMimeType(
      mimeType,
      path.extname(filename || "").replace(".", "") || "bin",
    );

    const safeFilename = this.sanitizeFilename(filename);

    const finalFilename = safeFilename || `${mediaId}.${extension}`;

    const uniquePrefix = crypto
      .createHash("sha256")
      .update(`${mediaId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 16);

    const storedFilename = `${uniquePrefix}-${finalFilename}`;

    const filePath = path.join(this.uploadDirectory, storedFilename);

    await fs.promises.writeFile(filePath, buffer);

    return {
      mediaId,
      filename: finalFilename,
      storedFilename,
      mimeType,
      size: buffer.length,
      path: filePath,
    };
  }

  async downloadAndSave({ mediaId, mimeType = null, filename = null } = {}) {
    const downloaded = await this.downloadMediaById(mediaId);

    const saved = await this.saveBuffer({
      buffer: downloaded.buffer,
      mediaId,
      mimeType: mimeType ?? downloaded.mimeType,
      filename,
    });

    return {
      ...saved,
      sha256: downloaded.sha256,
      metadata: downloaded.metadata,
    };
  }

  async resolveAttachments(attachments = []) {
    if (!Array.isArray(attachments)) {
      return [];
    }

    const resolved = [];

    for (const attachment of attachments) {
      if (!attachment?.mediaId) {
        resolved.push(attachment);
        continue;
      }

      try {
        const saved = await this.downloadAndSave({
          mediaId: attachment.mediaId,
          mimeType: attachment.mimeType,
          filename: attachment.filename,
        });

        resolved.push({
          ...attachment,
          downloaded: true,
          path: saved.path,
          storedFilename: saved.storedFilename,
          size: saved.size,
          sha256: saved.sha256,
        });
      } catch (error) {
        console.error("WhatsApp attachment processing failed:", error);

        resolved.push({
          ...attachment,
          downloaded: false,
          error: error.message,
        });
      }
    }

    return resolved;
  }
}
