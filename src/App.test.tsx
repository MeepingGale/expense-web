import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import App from "./App";

// Each test starts from a clean slate so persistence assertions are meaningful
// and one test can't leak state into the next via localStorage.
beforeEach(() => {
  cleanup();
  localStorage.clear();
});

/**
 * Helpers built from the REAL rendered DOM (see src/App.tsx + SettingsView.tsx):
 *  - Nav tabs are plain <button> elements with visible text ("Overview",
 *    "Settings", ...) inside <nav className="nav-tabs">.
 *  - The Settings view renders an "Appearance" section (<h2>Appearance</h2>)
 *    that re-homes the accent swatches, the density toggle (.need-toggle with
 *    "Comfortable"/"Compact"), and the budget-line toggle (.need-toggle with
 *    "On"/"Off").
 */
function gotoSettings() {
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
}

describe("App — smoke + parity", () => {
  it("renders the default overview", () => {
    const { container } = render(<App />);

    // Brand wordmark — <span className="brand-name">Ledger</span>. Note the
    // (hidden) PrintReport also renders "Ledger" in a .pr-brand div, so target
    // the topbar wordmark specifically rather than a bare getByText.
    const brand = container.querySelector(".brand-name");
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveTextContent("Ledger");

    // Overview nav tab exists and is the active one by default (view === "overview").
    const overviewTab = screen.getByRole("button", { name: "Overview" });
    expect(overviewTab).toBeInTheDocument();
    expect(overviewTab).toHaveClass("on");

    // Overview-only chrome confirms we're on the dashboard. The live overview
    // renders <main className="grid"> with a unique "Monthly spending" trend
    // heading (KPI labels like "Total spent" appear more than once between the
    // KPI card, the donut center label, and the hidden PrintReport).
    expect(container.querySelector("main.grid")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Monthly spending", level: 2 }),
    ).toBeInTheDocument();
    // Root carries the default density attribute from settings.
    expect(container.querySelector(".app")).toHaveAttribute(
      "data-density",
      "comfortable",
    );
  });

  it("Settings tab shows the re-homed Appearance controls", () => {
    render(<App />);
    gotoSettings();

    // Settings view header + the re-homed Appearance section heading.
    expect(
      screen.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeInTheDocument();
    const appearanceHeading = screen.getByRole("heading", {
      name: "Appearance",
      level: 2,
    });
    expect(appearanceHeading).toBeInTheDocument();

    // At least one re-homed control is present. The density toggle exposes two
    // visible buttons; "Comfortable" is selected by default (class "on").
    const comfortable = screen.getByRole("button", { name: "Comfortable" });
    const compact = screen.getByRole("button", { name: "Compact" });
    expect(comfortable).toHaveClass("on");
    expect(compact).not.toHaveClass("on");

    // Budget-line toggle (On/Off) is also re-homed here; default is On.
    expect(screen.getByRole("button", { name: "On" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Off" })).not.toHaveClass("on");

    // Accent swatches reuse currency-picker markup (.cur-opt). The accent
    // section lives under the Appearance heading; each swatch's accessible
    // name combines its capitalized id ("amber") with "Accent color".
    const amberSwatch = screen.getByRole("button", { name: /amber/i });
    expect(amberSwatch).toHaveClass("cur-opt");
  });

  it("persists a settings change across a full remount (regression for reset-on-reload)", () => {
    // 1) Mount, go to Settings, flip density from the default "comfortable"
    //    to "compact" via the real toggle button.
    const first = render(<App />);
    gotoSettings();

    const compactBtn = screen.getByRole("button", { name: "Compact" });
    expect(compactBtn).not.toHaveClass("on"); // default state
    fireEvent.click(compactBtn);

    // Change took effect in the live tree (toggle + root attribute).
    expect(screen.getByRole("button", { name: "Compact" })).toHaveClass("on");
    expect(first.container.querySelector(".app")).toHaveAttribute(
      "data-density",
      "compact",
    );

    // Sanity: it was actually written to localStorage (App's save effect).
    expect(localStorage.getItem("ledger-state-v1")).toContain('"density":"compact"');

    // 2) Fully unmount and mount a FRESH <App/>. The new instance hydrates
    //    from localStorage via load() in its initial state.
    first.unmount();
    const second = render(<App />);

    // Root reflects the persisted density immediately on the fresh overview.
    expect(second.container.querySelector(".app")).toHaveAttribute(
      "data-density",
      "compact",
    );

    // And the Settings toggle still shows "Compact" as the selected option.
    gotoSettings();
    expect(screen.getByRole("button", { name: "Compact" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Comfortable" })).not.toHaveClass(
      "on",
    );
  });

  it("adding a transaction updates the visible transaction count", () => {
    const { container } = render(<App />);

    // The overview "Transactions" card sub-line reads "<n> item(s)". Read the
    // current count from that sub-line, scoped to the Transactions card.
    const readCount = () => {
      const heading = screen.getByRole("heading", {
        name: "Transactions",
        level: 2,
      });
      const card = heading.closest("section") as HTMLElement;
      const text = within(card).getByText(/\d+\s+items?$/).textContent ?? "";
      return parseInt(text.match(/(\d+)\s+items?$/)![1], 10);
    };
    const before = readCount();

    // Open the AddExpense modal via the overview action button (.add-btn).
    fireEvent.click(container.querySelector(".add-btn") as HTMLElement);

    // AddExpense is a <form className="modal modal-tall"> (NOT role="dialog").
    // It pre-selects the first category and defaults the date to today, so a
    // positive amount alone makes the form valid (merchant defaults to the
    // category name when left blank). Set amount via its placeholder="0.00".
    const form = container.querySelector(".modal-tall") as HTMLElement;
    expect(form).toBeInTheDocument();
    const amount = within(form).getByPlaceholderText("0.00");
    fireEvent.change(amount, { target: { value: "12.50" } });
    // Optional merchant field (placeholder="Optional").
    fireEvent.change(within(form).getByPlaceholderText("Optional"), {
      target: { value: "Test Coffee" },
    });

    // Submit. The submit button is type="submit" with text "Add expense";
    // it's enabled once the form is valid.
    const submit = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    // The modal closes (onClose after submit) and the overview count grew by 1.
    expect(container.querySelector(".modal-tall")).toBeNull();
    expect(readCount()).toBe(before + 1);
  });
});
