export const FAZENDINHA_GROUP_ORDER = [
  "avestruz", "aguia", "burro", "borboleta", "cachorro",
  "cabra", "carneiro", "camelo", "cobra", "coelho",
  "cavalo", "elefante", "galo", "gato", "jacare",
  "leao", "macaco", "porco", "pavao", "peru",
  "touro", "tigre", "urso", "veado", "vaca",
];

export const FAZENDINHA_ANIMAL_MARKS: Record<string, string> = {
  avestruz: "🐦",
  aguia: "🦅",
  burro: "🐴",
  borboleta: "🦋",
  cachorro: "🐶",
  cabra: "🐐",
  carneiro: "🐏",
  camelo: "🐫",
  cobra: "🐍",
  coelho: "🐰",
  cavalo: "🐎",
  elefante: "🐘",
  galo: "🐓",
  gato: "🐱",
  jacare: "🐊",
  leao: "🦁",
  macaco: "🐒",
  porco: "🐷",
  pavao: "🦚",
  peru: "🦃",
  touro: "🐂",
  tigre: "🐯",
  urso: "🐻",
  veado: "🦌",
  vaca: "🐮",
};

export const fazendinhaOrderIndex = (id: string) => {
  const index = FAZENDINHA_GROUP_ORDER.indexOf(fazendinhaPublicGroupId(id));
  return index === -1 ? FAZENDINHA_GROUP_ORDER.length : index;
};

export const fazendinhaPublicGroupId = (id: string) => {
  const normalized = String(id || "");
  return normalized.includes(":") ? normalized.split(":").pop() || normalized : normalized;
};
