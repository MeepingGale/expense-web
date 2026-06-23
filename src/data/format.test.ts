import { describe, it, expect, beforeEach } from "vitest";
import { groupDigits, fmtUSD, fmtCompact, setLedgerCurrency } from "./format";

beforeEach(() => setLedgerCurrency("USD"));

describe("groupDigits", () => {
  it("groups thousands in the integer part", () => {
    expect(groupDigits("3000")).toBe("3,000");
    expect(groupDigits("1000000")).toBe("1,000,000");
    expect(groupDigits("12000000")).toBe("12,000,000");
  });
  it("leaves sub-thousand values alone", () => {
    expect(groupDigits("0")).toBe("0");
    expect(groupDigits("999")).toBe("999");
  });
  it("preserves the decimal part and a trailing dot (mid-typing)", () => {
    expect(groupDigits("1234.5")).toBe("1,234.5");
    expect(groupDigits("12.50")).toBe("12.50");
    expect(groupDigits("1000.")).toBe("1,000.");
    expect(groupDigits(".5")).toBe(".5");
  });
  it("handles empty input", () => {
    expect(groupDigits("")).toBe("");
  });
});

describe("fmtUSD", () => {
  it("formats whole amounts with thousands separators", () => {
    expect(fmtUSD(3000)).toBe("$3,000");
    expect(fmtUSD(1000000)).toBe("$1,000,000");
  });
  it("formats cents when asked", () => {
    expect(fmtUSD(1234.5, true)).toBe("$1,234.50");
  });
});

describe("fmtCompact", () => {
  it("uses k for thousands and M for millions", () => {
    expect(fmtCompact(800)).toBe("$800");
    expect(fmtCompact(3800)).toBe("$3.8k");
    expect(fmtCompact(15000)).toBe("$15k");
    expect(fmtCompact(1000000)).toBe("$1.0M");
    expect(fmtCompact(2500000)).toBe("$2.5M");
  });
});
