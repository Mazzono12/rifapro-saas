import type { Raffle, Story, Winner } from "../types";

export type MediaType = NonNullable<Raffle["mediaType"]> | Story["mediaType"] | Winner["mediaType"];

const imagePattern = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;
const videoPattern = /\.(m3u8|mov|mp4|webm|wmv|wma|wmi)(\?.*)?$/i;

export function inferMediaType(url = ""): MediaType {
  if (/youtu\.be|youtube\.com/i.test(url)) return "youtube";
  if (videoPattern.test(url)) return "video";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/iframe\.mediadelivery\.net|player\.mediadelivery\.net|video\.bunnycdn\.com|bunny\.net/i.test(url)) return "bunny";
  if (imagePattern.test(url)) return "image";
  return "image";
}

export function extractYouTubeId(url = "") {
  const patterns = [
    /youtu\.be\/([^?&#/]+)/i,
    /youtube\.com\/embed\/([^?&#/]+)/i,
    /youtube\.com\/shorts\/([^?&#/]+)/i,
    /youtube\.com\/watch\?(?:.*&)?v=([^?&#]+)/i,
    /youtube\.com\/.*[?&]v=([^?&#]+)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function extractVimeoId(url = "") {
  const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  return match?.[1] || "";
}

export function getBunnyEmbedUrl(url = "", params?: { autoPlay?: boolean; muted?: boolean; controls?: boolean }) {
  try {
    let parsed = new URL(url);
    if (/(^|\.)(video\.bunnycdn\.com|player\.mediadelivery\.net)$/i.test(parsed.hostname)) {
      const pathMatch = parsed.pathname.match(/^\/(?:play|embed)\/([^/]+)\/([^/?#]+)/i);
      if (!pathMatch) return "";
      parsed = new URL(`https://iframe.mediadelivery.net/embed/${pathMatch[1]}/${pathMatch[2]}`);
    }
    if (!/(^|\.)iframe\.mediadelivery\.net$/i.test(parsed.hostname)) return "";
    if (!/^\/(embed|play)\//i.test(parsed.pathname)) return "";
    parsed.searchParams.set("autoplay", params?.autoPlay ? "true" : "false");
    parsed.searchParams.set("muted", params?.muted ? "true" : "false");
    parsed.searchParams.set("controls", params?.controls === false ? "false" : "true");
    parsed.searchParams.set("responsive", "true");
    return parsed.toString();
  } catch {
    return "";
  }
}
