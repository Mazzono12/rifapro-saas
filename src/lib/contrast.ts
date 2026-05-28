type Rgb = { r: number; g: number; b: number };

const safeDark = "#020617";
const safeLight = "#f8fafc";

function expandHex(value: string) {
  const hex = value.replace("#", "").trim();
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return hex.split("").map(char => `${char}${char}`).join("");
  }
  return /^[0-9a-f]{6}$/i.test(hex) ? hex : "";
}

export function parseHexColor(value?: string | null): Rgb | null {
  const hex = expandHex(String(value || ""));
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

export function normalizeReadableColor(value?: string | null, fallback = "#00d66b") {
  return parseHexColor(value) ? String(value).trim() : fallback;
}

function channelToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(color?: string | null) {
  const rgb = parseHexColor(color);
  if (!rgb) return 0;
  return 0.2126 * channelToLinear(rgb.r) + 0.7152 * channelToLinear(rgb.g) + 0.0722 * channelToLinear(rgb.b);
}

export function getContrastRatio(foreground?: string | null, background?: string | null) {
  const fg = getRelativeLuminance(foreground);
  const bg = getRelativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextColor(backgroundColor?: string | null) {
  const background = normalizeReadableColor(backgroundColor, "#00d66b");
  const darkContrast = getContrastRatio(safeDark, background);
  const lightContrast = getContrastRatio(safeLight, background);
  return darkContrast >= lightContrast ? safeDark : safeLight;
}

export function hasReadableContrast(foreground?: string | null, background?: string | null, minimumRatio = 4.5) {
  return getContrastRatio(foreground, background) >= minimumRatio;
}
