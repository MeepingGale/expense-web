import { describe, it, expect } from "vitest";
import { safeViewType } from "./common";

describe("safeViewType", () => {
  it("lets inert viewable types through", () => {
    expect(safeViewType("image/png")).toBe("image/png");
    expect(safeViewType("application/pdf")).toBe("application/pdf");
  });
  it("downgrades scriptable types to a download (blob: URLs share the app origin)", () => {
    expect(safeViewType("image/svg+xml")).toBe("application/octet-stream");
    expect(safeViewType("text/html")).toBe("application/octet-stream");
    expect(safeViewType("")).toBe("application/octet-stream");
  });
});
