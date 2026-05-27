import { createHmac, timingSafeEqual } from "crypto";

export class WebhookService {
  validateSharedSecret(expected = "", provided = "") {
    if (!expected) return true;
    const a = Buffer.from(expected);
    const b = Buffer.from(provided || "");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  validateHmac(secret: string, payload: string, signature: string, algorithm: "sha256" | "sha1" = "sha256") {
    const expected = createHmac(algorithm, secret).update(payload).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature || "").replace(/^sha256=/, ""));
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
