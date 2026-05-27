import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export class CredentialVault {
  private key: Buffer;

  constructor(secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-integration-key") {
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(credentials: Record<string, unknown>) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt(payload = ""): Record<string, unknown> {
    if (!payload) return {};
    const [version, ivValue, tagValue, encryptedValue] = payload.split(":");
    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) return {};
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  }

  mask(credentials: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(credentials).map(([key, value]) => {
      if (value === undefined || value === null || value === "") return [key, ""];
      const text = String(value);
      return [key, text.length <= 6 ? "******" : `${text.slice(0, 3)}***${text.slice(-3)}`];
    }));
  }
}
