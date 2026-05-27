export type PrizeRarity = "common" | "rare" | "epic" | "legendary";

export interface LootboxPrize {
  name: string;
  value: number;
  type: string;
  rarity: PrizeRarity;
  tier?: string;
  wheelSegmentIndex?: number;
  wheelSegmentLabel?: string;
}

export interface LootboxOpenResult {
  boxId: string;
  won: boolean;
  prize?: LootboxPrize;
  nearMiss?: LootboxPrize & { progressText?: string };
  message?: string;
  remaining: number;
  effects?: {
    autoOpen?: boolean;
    sfx?: boolean;
    vfx?: boolean;
    confetti?: boolean;
  };
  experienceType?: "box" | "wheel";
  wheelSegments?: Array<{ label: string; color: string; imageUrl?: string; rewardEnabled?: boolean }>;
}

export interface LootboxQueueResult {
  available: number;
  boxes: Array<{
    id: string;
    status: "closed" | "opening";
    experienceType?: "box" | "wheel";
    wheelSegments?: Array<{ label: string; color: string; imageUrl?: string; rewardEnabled?: boolean }>;
  }>;
}

export const lootboxService = {
  async getAvailable(userId: string) {
    const res = await fetch(`/api/lootboxes/${userId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao consultar jogos premiados");
    return data as LootboxQueueResult;
  },

  async open(userId: string) {
    const res = await fetch(`/api/lootboxes/${userId}/open`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao abrir caixinha");
    return data as LootboxOpenResult;
  }
};
