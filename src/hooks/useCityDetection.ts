import { useEffect, useState } from "react";
import { GeoPrefillService, type GeoPrefill } from "../services/GeoPrefillService";

export function useCityDetection() {
  const [detectedCity, setDetectedCity] = useState<GeoPrefill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    GeoPrefillService.detect()
      .then(result => {
        if (!cancelled) setDetectedCity(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { detectedCity, loading };
}
