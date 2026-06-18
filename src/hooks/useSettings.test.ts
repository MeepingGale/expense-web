import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSettings } from "./useSettings";
import { DEFAULT_SETTINGS } from "../data/storage";

describe("useSettings", () => {
  it("updates a single key immutably", () => {
    const { result } = renderHook(() => useSettings(DEFAULT_SETTINGS));
    act(() => result.current[1]("theme", "light"));
    expect(result.current[0].theme).toBe("light");
    expect(result.current[0].accent).toBe(DEFAULT_SETTINGS.accent);
  });
});
