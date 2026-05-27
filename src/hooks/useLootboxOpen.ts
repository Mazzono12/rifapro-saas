import { useState } from "react";
import { lootboxService, type LootboxOpenResult } from "../services/lootboxService";

export function useLootboxOpen(userId: string) {
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<LootboxOpenResult | null>(null);

  const open = async () => {
    if (opening) return null;
    setOpening(true);
    setResult(null);
    try {
      const data = await lootboxService.open(userId);
      setResult(data);
      return data;
    } finally {
      setOpening(false);
    }
  };

  return { opening, result, setResult, open };
}
