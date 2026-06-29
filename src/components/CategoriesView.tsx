/* Category manager: main categories (name only) each holding sub-categories.
   Color + default type live on the sub-categories. State comes from App. */
import React, { useState, useMemo } from "react";
import { catColor, fmtUSD } from "../data/format";
import type { Category, CategoryId, MonthData, SubCategory } from "../types";

interface CategoriesViewProps {
  categories: Category[];
  months: MonthData[];
  onAdd: (cat: Category) => void;
  onEdit: (id: CategoryId, patch: Partial<Pick<Category, "name" | "subs">>) => void;
  onRemove: (id: CategoryId, reassignTo: CategoryId | null) => void;
}

const HUE_SWATCHES = [222, 196, 152, 120, 80, 48, 22, 8, 330, 300, 280, 258];

function slugify(name: string, existing: Set<string>): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
  let id = base, n = 2;
  while (existing.has(id)) id = base + "-" + n++;
  return id;
}

type SubDraft = { id: string | null; name: string; hue: number; essential: boolean };
const emptySub = (hue: number): SubDraft => ({ id: null, name: "", hue, essential: true });
const nextHue = (used: Set<number>) => HUE_SWATCHES.find((h) => !used.has(h)) ?? HUE_SWATCHES[0];

export function CategoriesView({ categories, months, onAdd, onEdit, onRemove }: CategoriesViewProps) {
  const [newMain, setNewMain] = useState("");
  const [renameId, setRenameId] = useState<CategoryId | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmId, setConfirmId] = useState<CategoryId | null>(null);
  const [reassign, setReassign] = useState<CategoryId>("");
  const [subFormCat, setSubFormCat] = useState<CategoryId | null>(null);
  const [subDraft, setSubDraft] = useState<SubDraft>(emptySub(120));

  // usage per main category across all months
  const usage = useMemo<Record<string, { count: number; total: number }>>(() => {
    const u: Record<string, { count: number; total: number }> = {};
    categories.forEach((c) => (u[c.id] = { count: 0, total: 0 }));
    months.forEach((m) => m.transactions.forEach((tx) => {
      if (u[tx.cat]) { u[tx.cat].count++; u[tx.cat].total += tx.amount; }
    }));
    return u;
  }, [categories, months]);

  const ids = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  const addMain = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMain.trim();
    if (!name) return;
    onAdd({ id: slugify(name, ids), name, hue: nextHue(new Set(categories.map((c) => c.hue))), subs: [] });
    setNewMain("");
  };

  const startRename = (c: Category) => { setRenameId(c.id); setRenameVal(c.name); };
  const commitRename = () => {
    if (renameId && renameVal.trim()) onEdit(renameId, { name: renameVal.trim() });
    setRenameId(null);
  };

  const startRemove = (id: CategoryId) => {
    setConfirmId(id);
    const other = categories.find((c) => c.id !== id);
    setReassign(other ? other.id : "");
  };
  const confirmRemove = () => {
    if (confirmId == null) return;
    onRemove(confirmId, (usage[confirmId]?.count ?? 0) > 0 ? reassign : null);
    setConfirmId(null);
  };

  const openSubForm = (cat: Category, sub?: SubCategory) => {
    setSubFormCat(cat.id);
    setSubDraft(sub ? { ...sub } : emptySub(nextHue(new Set(cat.subs.map((s) => s.hue)))));
  };
  const saveSub = (cat: Category) => {
    const name = subDraft.name.trim();
    if (!name) return;
    const subs: SubCategory[] = subDraft.id
      ? cat.subs.map((s) => (s.id === subDraft.id ? { ...s, name, hue: subDraft.hue, essential: subDraft.essential } : s))
      : [...cat.subs, { id: slugify(name, new Set(cat.subs.map((s) => s.id))), name, hue: subDraft.hue, essential: subDraft.essential }];
    onEdit(cat.id, { subs });
    setSubFormCat(null);
  };
  const removeSub = (cat: Category, subId: string) => {
    onEdit(cat.id, { subs: cat.subs.filter((s) => s.id !== subId) });
    if (subFormCat === cat.id && subDraft.id === subId) setSubFormCat(null);
  };

  return (
    <div className="catv">
      <div className="catv-head">
        <div>
          <h1>Categories</h1>
          <p className="txv-sub">{categories.length} categories · add sub-categories to break spending down</p>
        </div>
        <form className="catv-addmain" onSubmit={addMain}>
          <input value={newMain} placeholder="New category name" maxLength={24} onChange={(e) => setNewMain(e.target.value)} />
          <button type="submit" className="btn primary" disabled={!newMain.trim()}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add category
          </button>
        </form>
      </div>

      <div className="catv-mains">
        {categories.map((c) => {
          const u = usage[c.id] || { count: 0, total: 0 };
          const confirming = confirmId === c.id;
          const others = categories.filter((x) => x.id !== c.id);
          return (
            <div key={c.id} className={"card catv-main" + (confirming ? " confirming" : "")}>
              <div className="catv-main-head">
                <span className="cat-swatch" style={{ background: catColor(c.hue) }} />
                {renameId === c.id ? (
                  <input className="catv-rename" autoFocus value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenameId(null); }} />
                ) : (
                  <button className="catv-main-name" onClick={() => startRename(c)} title="Rename">{c.name}</button>
                )}
                <span className="catv-main-usage">{c.subs.length} sub{c.subs.length !== 1 ? "s" : ""}{u.count > 0 ? ` · ${u.count} tx · ${fmtUSD(u.total)}` : ""}</span>
                <button className="cat-edit-btn" onClick={() => startRename(c)} title="Rename category" aria-label={"Rename " + c.name}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11.4 2.6a1.6 1.6 0 0 1 2.3 2.3L6 12.6l-3 .8.8-3 7.6-7.8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="cat-del-btn" onClick={() => startRemove(c.id)} disabled={categories.length <= 1}
                  title={categories.length <= 1 ? "Keep at least one category" : "Delete category"} aria-label={"Delete " + c.name}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {confirming && (
                <div className="cat-confirm">
                  {u.count > 0 ? (
                    <div className="cat-confirm-row">
                      <span>Move its <b>{u.count}</b> transaction{u.count !== 1 ? "s" : ""} to</span>
                      <label className="txv-select-wrap">
                        <select value={reassign} onChange={(e) => setReassign(e.target.value)}>
                          {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <span>Delete <b>{c.name}</b>? This can’t be undone.</span>
                  )}
                  <div className="cat-confirm-actions">
                    <button className="btn ghost" onClick={() => setConfirmId(null)}>Cancel</button>
                    <button className="btn danger" onClick={confirmRemove}>Delete</button>
                  </div>
                </div>
              )}

              <div className="catv-subs">
                {c.subs.map((s) => (
                  <div key={s.id} className="catv-sub">
                    <span className="cat-swatch sm" style={{ background: catColor(s.hue) }} />
                    <span className="catv-sub-name">{s.name}</span>
                    <span className={"need-tag " + (s.essential ? "is-need" : "is-want")}>{s.essential ? "Need" : "Want"}</span>
                    <button className="cat-edit-btn sm" onClick={() => openSubForm(c, s)} title="Edit sub-category" aria-label={"Edit " + s.name}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.4 2.6a1.6 1.6 0 0 1 2.3 2.3L6 12.6l-3 .8.8-3 7.6-7.8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="cat-del-btn sm" onClick={() => removeSub(c, s.id)} title="Delete sub-category" aria-label={"Delete " + s.name}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                ))}
                {c.subs.length === 0 && subFormCat !== c.id && <span className="catv-nosubs">No sub-categories yet.</span>}

                {subFormCat === c.id ? (
                  <div className="catv-subform">
                    <input className="catv-subname" autoFocus value={subDraft.name} placeholder="Sub-category name" maxLength={24}
                      onChange={(e) => setSubDraft((d) => ({ ...d, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") saveSub(c); if (e.key === "Escape") setSubFormCat(null); }} />
                    <div className="catv-subhues">
                      {HUE_SWATCHES.map((h) => (
                        <button type="button" key={h} className={"hue-swatch sm" + (subDraft.hue === h ? " sel" : "")}
                          style={{ background: catColor(h) }} onClick={() => setSubDraft((d) => ({ ...d, hue: h }))} aria-label={"hue " + h}>
                          {subDraft.hue === h && <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                      ))}
                    </div>
                    <div className="need-toggle sm">
                      <button type="button" className={subDraft.essential ? "on" : ""} onClick={() => setSubDraft((d) => ({ ...d, essential: true }))}>Need</button>
                      <button type="button" className={!subDraft.essential ? "on" : ""} onClick={() => setSubDraft((d) => ({ ...d, essential: false }))}>Want</button>
                    </div>
                    <div className="catv-subform-actions">
                      <button type="button" className="btn ghost" onClick={() => setSubFormCat(null)}>Cancel</button>
                      <button type="button" className="btn primary" disabled={!subDraft.name.trim()} onClick={() => saveSub(c)}>{subDraft.id ? "Save" : "Add"}</button>
                    </div>
                  </div>
                ) : (
                  <button className="catv-addsub" onClick={() => openSubForm(c)}>
                    <svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    Add sub-category
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
