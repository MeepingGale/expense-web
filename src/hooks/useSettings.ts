import { useState, useCallback } from "react";
import type { Settings } from "../types";

export type SetSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

// Holds appearance/chart settings. Replaces the artifact's useTweaks:
// no postMessage; persistence is handled by App's storage effect (settings
// are part of the StoredStateV2 blob).
export function useSettings(initial: Settings): [Settings, SetSetting] {
  const [settings, setSettings] = useState<Settings>(initial);
  const set = useCallback<SetSetting>((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);
  return [settings, set];
}
