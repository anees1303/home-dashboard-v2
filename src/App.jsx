import React, { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, PROJECT_DOC_ID } from "./firebase";

const PHASES = ["Planning", "Foundation", "Structure", "Roofing", "Electrical", "Plumbing", "Flooring", "Painting", "Finishing"];

const EXPENSE_CATS = [
  { key: "material", label: "Material", icon: "🧱", color: "#F97316" },
  { key: "labour", label: "Labour", icon: "👷", color: "#3B82F6" },
  { key: "transport", label: "Transport", icon: "🚛", color: "#A855F7" },
  { key: "permits", label: "Permits", icon: "📋", color: "#10B981" },
  { key: "architect", label: "Architect", icon: "📐", color: "#EF4444" },
  { key: "misc", label: "Other", icon: "📦", color: "#94A3B8" }
];

const PAY_MODES = [
  { val: "upi", label: "UPI", icon: "📱", color: "#A855F7" },
  { val: "cash", label: "Cash", icon: "💵", color: "#EAB308" },
  { val: "cheque", label: "Cheque", icon: "🏦", color: "#3B82F6" },
  { val: "bank", label: "Bank", icon: "🏧", color: "#10B981" }
];

const STOCK_STATUS = {
  sufficient: { label: "In Stock", color: "#10B981" },
  low: { label: "Low", color: "#EAB308" },
  out: { label: "Out", color: "#EF4444" }
};

const TABS = [
  { key: "overview", label: "Home", icon: "🏠" },
  { key: "expenses", label: "Money", icon: "💰" },
  { key: "stock", label: "Stock", icon: "📦" },
  { key: "photos", label: "Photos", icon: "📸" },
  { key: "labour", label: "Labour", icon: "👷" },
  { key: "timeline", label: "Plan", icon: "📅" },
  { key: "contacts", label: "People", icon: "📞" },
  { key: "checklist", label: "Docs", icon: "✅" },
  { key: "export", label: "Export", icon: "📄" }
];

const DEFAULT_DATA = {
  budget: 0,
  projectName: "My Dream Home",
  currentPhase: "Planning",
  expenses: [],
  stock: [],
  photos: [],
  milestones: PHASES.map(p => ({ phase: p, planned: "", actual: "", done: false })),
  contacts: [],
  labour: [],
  checklist: [
    { id: 1, item: "Land documents verified", done: false, category: "Legal", docLink: "" },
    { id: 2, item: "Building plan approved", done: false, category: "Permits", docLink: "" },
    { id: 3, item: "Soil testing done", done: false, category: "Pre-construction", docLink: "" },
    { id: 4, item: "Architect finalized", done: false, category: "Planning", docLink: "" },
    { id: 5, item: "Contractor agreement signed", done: false, category: "Legal", docLink: "" },
    { id: 6, item: "Water connection applied", done: false, category: "Utilities", docLink: "" },
    { id: 7, item: "Electricity connection applied", done: false, category: "Utilities", docLink: "" },
    { id: 8, item: "Construction insurance", done: false, category: "Legal", docLink: "" },
    { id: 9, item: "Bank loan sanctioned", done: false, category: "Finance", docLink: "" },
    { id: 10, item: "Municipal NOC obtained", done: false, category: "Permits", docLink: "" }
  ]
};

// Helpers
const fmt = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtShort = n => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return fmt(n);
};
const dateStr = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
const timeAgo = d => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const getDriveUrl = link => {
  if (!link) return "";
  let id = "";
  for (const p of [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/]) {
    const m = link.match(p);
    if (m) { id = m[1]; break; }
  }
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : link;
};
const getDriveOpen = link => {
  if (!link) return "#";
  let id = "";
  for (const p of [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/]) {
    const m = link.match(p);
    if (m) { id = m[1]; break; }
  }
  return id ? `https://drive.google.com/file/d/${id}/view` : link;
};

// Dark theme styles
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
body { background: #0A0A0A; color: #FAFAFA; font-family: 'Inter', sans-serif; }

@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideUp { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
@keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 40px rgba(249,115,22,0.5); } }

.app { font-family: 'Inter', sans-serif; background: #0A0A0A; min-height: 100vh; max-width: 500px; margin: 0 auto; padding-bottom: 95px; color: #FAFAFA; }

.header { background: linear-gradient(180deg, #18181B 0%, #0A0A0A 100%); padding: 18px 20px 16px; position: sticky; top: 0; z-index: 50; border-bottom: 1px solid #27272A; }

.card { background: #18181B; border: 1px solid #27272A; border-radius: 16px; padding: 18px 20px; animation: fadeUp 0.4s ease both; }

.card-glow { background: linear-gradient(135deg, #18181B 0%, #27272A 100%); border: 1px solid #3F3F46; }

.btn-p { background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); color: #fff; border: none; border-radius: 12px; padding: 14px 24px; font-weight: 600; font-size: 15px; cursor: pointer; font-family: inherit; width: 100%; transition: all 0.2s; }
.btn-p:active { transform: scale(0.97); }
.btn-p:disabled { opacity: 0.4; }

.inp { width: 100%; padding: 12px 16px; border: 1.5px solid #27272A; border-radius: 12px; font-size: 15px; font-family: inherit; background: #0A0A0A; outline: none; color: #FAFAFA; transition: all 0.2s; }
.inp:focus { border-color: #F97316; }
.inp::placeholder { color: #52525B; }

.lbl { font-size: 11px; font-weight: 600; color: #A1A1AA; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.8px; }

.chip { border: none; border-radius: 24px; padding: 8px 16px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; transition: all 0.2s; }

.fab { position: fixed; bottom: 100px; right: 20px; width: 60px; height: 60px; border-radius: 20px; background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); color: #fff; border: none; font-size: 28px; cursor: pointer; box-shadow: 0 8px 24px rgba(249,115,22,0.4); z-index: 100; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.fab:active { transform: scale(0.9) rotate(90deg); }

.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
.modal-c { background: #18181B; border: 1px solid #27272A; border-radius: 24px 24px 0 0; width: 100%; max-width: 500px; max-height: 88vh; overflow: auto; padding: 28px 24px 36px; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }

.bnav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(10,10,10,0.85); backdrop-filter: blur(20px); border-top: 1px solid #27272A; display: flex; justify-content: center; padding: 8px 0 env(safe-area-inset-bottom, 12px); z-index: 200; }
.nb { background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; cursor: pointer; min-width: 0; font-family: inherit; }
.nb:active { transform: scale(0.9); }

.action-row { display: flex; gap: 8px; margin-top: 10px; }
.action-btn { background: none; border: 1px solid #27272A; font-size: 11px; cursor: pointer; font-family: inherit; padding: 5px 12px; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
.edit-btn { color: #F97316; border-color: #422006; background: rgba(249,115,22,0.1); }
.remove-btn { color: #EF4444; border-color: #450A0A; background: rgba(239,68,68,0.1); }
.link-btn { color: #A855F7; border-color: #3B0764; background: rgba(168,85,247,0.1); text-decoration: none; display: inline-block; }

input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }

@media print {
  .bnav, .fab, .no-print { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
}
`;

// Mini components
function Card({ children, style, onClick, delay = 0, glow }) {
  return <div onClick={onClick} className={glow ? "card card-glow" : "card"} style={{ animationDelay: `${delay * 0.05}s`, ...style }}>{children}</div>;
}
function Inp({ label, ...p }) {
  return <div style={{ marginBottom: 16 }}>{label && <label className="lbl">{label}</label>}<input {...p} className="inp" style={p.style} /></div>;
}
function Sel({ label, options, ...p }) {
  return <div style={{ marginBottom: 16 }}>{label && <label className="lbl">{label}</label>}<select {...p} className="inp" style={{ appearance: "auto", ...p.style }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-c" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: "#FAFAFA", fontFamily: "'Playfair Display',serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#27272A", border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", color: "#A1A1AA", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({ icon, text }) {
  return <div style={{ textAlign: "center", padding: "60px 20px", color: "#52525B" }}><div style={{ fontSize: 56, marginBottom: 14, opacity: 0.5 }}>{icon}</div><div style={{ fontSize: 14, lineHeight: 1.6 }}>{text}</div></div>;
}
function Badge({ children, color }) {
  return <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: `${color}20`, color, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", border: `1px solid ${color}40` }}>{children}</span>;
}
function Actions({ onEdit, onRemove }) {
  return <div className="action-row"><button className="action-btn edit-btn" onClick={onEdit}>✏️ Edit</button><button className="action-btn remove-btn" onClick={onRemove}>🗑️ Remove</button></div>;
}

// ─── OVERVIEW ───
function OverviewPanel({ data, setData, setTab }) {
  const totalSpent = data.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const remaining = data.budget - totalSpent;
  const pct = data.budget > 0 ? Math.min((totalSpent / data.budget) * 100, 100) : 0;
  const phaseIdx = PHASES.indexOf(data.currentPhase);
  const progressPct = ((phaseIdx + 1) / PHASES.length) * 100;
  const pendingAmt = data.expenses.filter(e => !e.paid).reduce((s, e) => s + Number(e.amount || 0), 0);
  const checkDone = data.checklist.filter(c => c.done).length;
  const lowStock = data.stock.filter(s => s.status === "low" || s.status === "out").length;
  const catTotals = EXPENSE_CATS.map(c => ({ ...c, total: data.expenses.filter(e => e.category === c.key).reduce((s, e) => s + Number(e.amount || 0), 0) })).sort((a, b) => b.total - a.total);

  const [editing, setEditing] = useState(false);
  const [bi, setBi] = useState(data.budget || "");
  const [pi, setPi] = useState(data.currentPhase);
  const [ni, setNi] = useState(data.projectName || "");

  const recent = [
    ...data.expenses.map(e => ({ desc: e.desc, amount: e.amount, time: e.id, icon: "💰" })),
    ...data.stock.map(s => ({ desc: s.item, time: s.id, icon: "📦" })),
    ...data.labour.map(l => ({ desc: `${l.workers} workers`, time: l.id, icon: "👷" }))
  ].sort((a, b) => b.time - a.time).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card glow style={{ padding: "24px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.15), transparent)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 500 }}>{data.projectName || "My Home"}</div>
            <button onClick={() => { setEditing(!editing); setBi(data.budget); setPi(data.currentPhase); setNi(data.projectName || ""); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #27272A", borderRadius: 8, padding: "5px 12px", color: "#A1A1AA", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{editing ? "Cancel" : "⚙️ Edit"}</button>
          </div>

          {editing ? (
            <div style={{ marginTop: 14 }}>
              <input value={ni} onChange={e => setNi(e.target.value)} placeholder="Project name" className="inp" style={{ marginBottom: 10 }} />
              <input value={bi} onChange={e => setBi(e.target.value)} placeholder="Total budget" type="number" className="inp" style={{ marginBottom: 10 }} />
              <select value={pi} onChange={e => setPi(e.target.value)} className="inp" style={{ marginBottom: 12 }}>{PHASES.map(p => <option key={p} value={p}>{p}</option>)}</select>
              <button className="btn-p" onClick={() => { setData(d => ({ ...d, budget: Number(bi) || 0, currentPhase: pi, projectName: ni })); setEditing(false); }}>Save Changes</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 38, fontWeight: 700, fontFamily: "'Playfair Display',serif", margin: "8px 0 6px", letterSpacing: -0.5, color: "#FAFAFA" }}>{fmt(data.budget)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 20, fontSize: 12, color: "#D4D4D8" }}>Spent <b style={{ color: "#FAFAFA" }}>{fmtShort(totalSpent)}</b></span>
                <span style={{ background: remaining < 0 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)", padding: "4px 12px", borderRadius: 20, fontSize: 12, color: remaining < 0 ? "#FCA5A5" : "#6EE7B7" }}>Left <b>{fmtShort(remaining)}</b></span>
                {pendingAmt > 0 && <span style={{ background: "rgba(234,179,8,0.15)", padding: "4px 12px", borderRadius: 20, fontSize: 12, color: "#FDE047" }}>Pending <b>{fmtShort(pendingAmt)}</b></span>}
              </div>
              <div style={{ background: "#27272A", borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 8, transition: "width 0.8s", background: pct > 90 ? "linear-gradient(90deg,#EF4444,#DC2626)" : pct > 70 ? "linear-gradient(90deg,#F59E0B,#D97706)" : "linear-gradient(90deg,#10B981,#059669)" }} />
              </div>
              <div style={{ fontSize: 11, color: "#71717A", marginTop: 6, textAlign: "right" }}>{pct.toFixed(0)}% spent</div>
            </>
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card delay={1} style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: "#71717A", textTransform: "uppercase", letterSpacing: 1 }}>Phase</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontFamily: "'Playfair Display',serif", color: "#FAFAFA" }}>🏗️ {data.currentPhase}</div>
          <div style={{ background: "#27272A", borderRadius: 6, height: 5, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${progressPct}%`, height: "100%", background: "#10B981", borderRadius: 6 }} /></div>
          <div style={{ fontSize: 10, color: "#71717A", marginTop: 4 }}>{phaseIdx + 1} of {PHASES.length}</div>
        </Card>
        <Card delay={2} style={{ padding: 16, cursor: "pointer" }} onClick={() => setTab("checklist")}>
          <div style={{ fontSize: 10, color: "#71717A", textTransform: "uppercase", letterSpacing: 1 }}>Documents</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#FAFAFA" }}>{checkDone}/{data.checklist.length}</div>
          <div style={{ fontSize: 10, color: "#71717A", marginTop: 4, fontWeight: 600 }}>{data.checklist.length - checkDone} pending</div>
        </Card>
      </div>

      {lowStock > 0 && <Card delay={3} style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", cursor: "pointer" }} onClick={() => setTab("stock")}><div style={{ fontSize: 13, fontWeight: 600, color: "#FDE047" }}>⚠️ {lowStock} material{lowStock > 1 ? "s" : ""} running low</div></Card>}
      {pendingAmt > 0 && <Card delay={4} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }} onClick={() => setTab("expenses")}><div style={{ fontSize: 13, fontWeight: 600, color: "#FCA5A5" }}>🔴 {fmt(pendingAmt)} payments pending</div></Card>}

      <Card delay={5}>
        <div style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 600 }}>Where the money goes</div>
        {catTotals.filter(c => c.total > 0).length === 0 ? <div style={{ fontSize: 13, color: "#71717A", textAlign: "center", padding: 10 }}>No expenses yet</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {catTotals.filter(c => c.total > 0).map(c => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "#D4D4D8", fontWeight: 500 }}>{c.label}</span>
                    <span style={{ fontWeight: 700, color: "#FAFAFA" }}>{fmt(c.total)}</span>
                  </div>
                  <div style={{ background: "#27272A", borderRadius: 4, height: 6, overflow: "hidden" }}><div style={{ width: `${(c.total / totalSpent) * 100}%`, height: "100%", background: c.color, borderRadius: 4 }} /></div>
                </div>
              </div>
            ))}
          </div>}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[{ n: data.expenses.length, l: "Payments", i: "💳", t: "expenses" }, { n: data.stock.length, l: "Materials", i: "🧱", t: "stock" }, { n: data.photos.length, l: "Photos", i: "📸", t: "photos" }].map((s, idx) => (
          <Card key={s.l} delay={6 + idx} style={{ textAlign: "center", padding: "14px 8px", cursor: "pointer" }} onClick={() => setTab(s.t)}>
            <div style={{ fontSize: 20 }}>{s.i}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: "#FAFAFA" }}>{s.n}</div>
            <div style={{ fontSize: 10, color: "#71717A" }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {recent.length > 0 && (
        <Card delay={9}>
          <div style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 600 }}>Recent Activity</div>
          {recent.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#FAFAFA" }}>{r.desc}</div>
                <div style={{ fontSize: 10, color: "#71717A" }}>{timeAgo(r.time)}</div>
              </div>
              {r.amount && <span style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>{fmtShort(r.amount)}</span>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── EXPENSES ───
function ExpensesPanel({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const blank = { desc: "", amount: "", category: "material", date: new Date().toISOString().split("T")[0], paid: true, payMode: "upi", note: "", receiptLink: "" };
  const [form, setForm] = useState(blank);

  const filtered = (filter === "all" ? data.expenses : data.expenses.filter(e => e.category === filter)).filter(e => !search || e.desc.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalF = sorted.reduce((s, e) => s + Number(e.amount || 0), 0);
  const paidT = sorted.filter(e => e.paid).reduce((s, e) => s + Number(e.amount || 0), 0);

  const save = () => {
    if (!form.desc || !form.amount) return;
    if (editId) {
      setData(d => ({ ...d, expenses: d.expenses.map(e => e.id === editId ? { ...form, id: editId, amount: Number(form.amount) } : e) }));
    } else {
      setData(d => ({ ...d, expenses: [...d.expenses, { ...form, id: Date.now(), amount: Number(form.amount) }] }));
    }
    setForm(blank); setEditId(null); setModal(false);
  };
  const edit = e => { setForm({ desc: e.desc, amount: String(e.amount), category: e.category, date: e.date, paid: e.paid, payMode: e.payMode || "upi", note: e.note || "", receiptLink: e.receiptLink || "" }); setEditId(e.id); setModal(true); };

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search expenses..." className="inp" style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 10 }}>
        <button onClick={() => setFilter("all")} className="chip" style={{ background: filter === "all" ? "#F97316" : "#18181B", color: filter === "all" ? "#fff" : "#A1A1AA", border: "1px solid #27272A" }}>All</button>
        {EXPENSE_CATS.map(c => <button key={c.key} onClick={() => setFilter(c.key)} className="chip" style={{ background: filter === c.key ? c.color : "#18181B", color: filter === c.key ? "#fff" : "#A1A1AA", border: "1px solid #27272A" }}>{c.icon} {c.label}</button>)}
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase" }}>{sorted.length} transactions</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Playfair Display',serif", marginTop: 2, color: "#FAFAFA" }}>{fmt(totalF)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>✓ Paid: {fmtShort(paidT)}</div>
            {totalF - paidT > 0 && <div style={{ fontSize: 11, color: "#EAB308", fontWeight: 600, marginTop: 2 }}>⏳ Pending: {fmtShort(totalF - paidT)}</div>}
          </div>
        </div>
      </Card>

      {sorted.length === 0 ? <Empty icon="💰" text="No expenses recorded yet." /> : sorted.map((e, i) => {
        const cat = EXPENSE_CATS.find(c => c.key === e.category) || EXPENSE_CATS[5];
        const pm = PAY_MODES.find(m => m.val === e.payMode);
        return (
          <Card key={e.id} delay={i} style={{ padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10, flex: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cat.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, border: `1px solid ${cat.color}30` }}>{cat.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#FAFAFA" }}>{e.desc}</div>
                  <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>{cat.label} · {dateStr(e.date)}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {pm && <Badge color={pm.color}>{pm.icon} {pm.label}</Badge>}
                    <Badge color={e.paid ? "#10B981" : "#EAB308"}>{e.paid ? "✓ Paid" : "⏳ Pending"}</Badge>
                  </div>
                  {e.note && <div style={{ fontSize: 11, color: "#A1A1AA", marginTop: 4, fontStyle: "italic" }}>{e.note}</div>}
                  {e.receiptLink && <a href={getDriveOpen(e.receiptLink)} target="_blank" rel="noopener noreferrer" className="action-btn link-btn" style={{ marginTop: 6 }}>📎 View Receipt</a>}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", marginLeft: 8, color: "#FAFAFA" }}>{fmt(e.amount)}</div>
            </div>
            <Actions onEdit={() => edit(e)} onRemove={() => setData(d => ({ ...d, expenses: d.expenses.filter(x => x.id !== e.id) }))} />
          </Card>
        );
      })}

      <button className="fab" onClick={() => { setForm(blank); setEditId(null); setModal(true); }}>+</button>

      {modal && (
        <Modal title={editId ? "Edit Expense" : "Add Expense"} onClose={() => { setModal(false); setEditId(null); }}>
          <Inp label="Description" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="e.g. Cement bags (50)" />
          <Inp label="Amount (₹)" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          <Sel label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={EXPENSE_CATS.map(c => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          <Inp label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <div style={{ marginBottom: 16 }}>
            <label className="lbl">Payment Status</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {[true, false].map(v => <button key={String(v)} onClick={() => setForm({ ...form, paid: v })} style={{ flex: 1, padding: 11, borderRadius: 10, border: `2px solid ${form.paid === v ? (v ? "#10B981" : "#EAB308") : "#27272A"}`, background: form.paid === v ? (v ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)") : "#0A0A0A", fontSize: 13, fontWeight: 600, color: form.paid === v ? (v ? "#10B981" : "#EAB308") : "#71717A", cursor: "pointer", fontFamily: "inherit" }}>{v ? "✓ Paid" : "⏳ Pending"}</button>)}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="lbl">Payment Mode</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
              {PAY_MODES.map(m => <button key={m.val} onClick={() => setForm({ ...form, payMode: m.val })} style={{ padding: 11, borderRadius: 10, border: `2px solid ${form.payMode === m.val ? m.color : "#27272A"}`, background: form.payMode === m.val ? `${m.color}20` : "#0A0A0A", fontSize: 12, fontWeight: 600, color: form.payMode === m.val ? m.color : "#71717A", cursor: "pointer", fontFamily: "inherit" }}>{m.icon} {m.label}</button>)}
            </div>
          </div>
          <Inp label="Receipt Link (Google Drive)" value={form.receiptLink} onChange={e => setForm({ ...form, receiptLink: e.target.value })} placeholder="Paste Drive link" />
          <Inp label="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Any extra details..." />
          <button className="btn-p" onClick={save} disabled={!form.desc || !form.amount}>{editId ? "Save Changes" : "Add Expense"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── STOCK ───
function StockPanel({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { item: "", qty: "", used: "", unit: "bags", supplier: "", status: "sufficient" };
  const [form, setForm] = useState(blank);

  const save = () => {
    if (!form.item) return;
    const entry = { ...form, qty: Number(form.qty) || 0, used: Number(form.used) || 0 };
    if (editId) setData(d => ({ ...d, stock: d.stock.map(s => s.id === editId ? { ...entry, id: editId } : s) }));
    else setData(d => ({ ...d, stock: [...d.stock, { ...entry, id: Date.now() }] }));
    setForm(blank); setEditId(null); setModal(false);
  };
  const edit = s => { setForm({ item: s.item, qty: String(s.qty), used: String(s.used), unit: s.unit, supplier: s.supplier || "", status: s.status }); setEditId(s.id); setModal(true); };
  const grouped = { sufficient: [], low: [], out: [] };
  data.stock.forEach(s => (grouped[s.status] || grouped.sufficient).push(s));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Object.entries(STOCK_STATUS).map(([k, v]) => <div key={k} style={{ flex: 1, background: "#18181B", border: `1px solid ${v.color}40`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700, color: v.color }}>{grouped[k]?.length || 0}</div><div style={{ fontSize: 10, color: v.color, fontWeight: 600 }}>{v.label}</div></div>)}
      </div>

      {data.stock.length === 0 ? <Empty icon="📦" text="No materials tracked yet." /> : data.stock.map((s, i) => {
        const st = STOCK_STATUS[s.status] || STOCK_STATUS.sufficient;
        const remaining = s.qty - s.used;
        const pct = s.qty > 0 ? (s.used / s.qty) * 100 : 0;
        return (
          <Card key={s.id} delay={i} style={{ padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#FAFAFA" }}>{s.item}</div>
                <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 4 }}>{s.qty} {s.unit} · {s.used} used · <b style={{ color: st.color }}>{remaining} left</b></div>
                {s.supplier && <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>📍 {s.supplier}</div>}
              </div>
              <Badge color={st.color}>{st.label}</Badge>
            </div>
            <div style={{ background: "#27272A", borderRadius: 4, height: 5, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: pct > 80 ? "#EF4444" : pct > 50 ? "#EAB308" : "#10B981", borderRadius: 4 }} /></div>
            <Actions onEdit={() => edit(s)} onRemove={() => setData(d => ({ ...d, stock: d.stock.filter(x => x.id !== s.id) }))} />
          </Card>
        );
      })}

      <button className="fab" onClick={() => { setForm(blank); setEditId(null); setModal(true); }}>+</button>
      {modal && (
        <Modal title={editId ? "Edit Material" : "Add Material"} onClose={() => { setModal(false); setEditId(null); }}>
          <Inp label="Material Name" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g. Cement, Sand" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Inp label="Quantity" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="0" />
            <Sel label="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} options={[{ value: "bags", label: "Bags" }, { value: "kg", label: "KG" }, { value: "tons", label: "Tons" }, { value: "pieces", label: "Pieces" }, { value: "sqft", label: "Sq Ft" }, { value: "cft", label: "CFT" }, { value: "nos", label: "Nos" }, { value: "liters", label: "Liters" }, { value: "loads", label: "Loads" }]} />
          </div>
          <Inp label="Used" type="number" value={form.used} onChange={e => setForm({ ...form, used: e.target.value })} placeholder="0" />
          <Inp label="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. Sri Balaji Traders" />
          <Sel label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={[{ value: "sufficient", label: "✅ In Stock" }, { value: "low", label: "⚠️ Running Low" }, { value: "out", label: "🔴 Out of Stock" }]} />
          <button className="btn-p" onClick={save} disabled={!form.item}>{editId ? "Save Changes" : "Add Material"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── PHOTOS ───
function PhotosPanel({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [vp, setVp] = useState(null);
  const blank = { caption: "", phase: "Foundation", date: new Date().toISOString().split("T")[0], driveLink: "" };
  const [form, setForm] = useState(blank);

  const save = () => {
    if (!form.driveLink) return;
    const entry = { ...form, url: getDriveUrl(form.driveLink) };
    if (editId) setData(d => ({ ...d, photos: d.photos.map(p => p.id === editId ? { ...entry, id: editId } : p) }));
    else setData(d => ({ ...d, photos: [...d.photos, { ...entry, id: Date.now() }] }));
    setForm(blank); setEditId(null); setModal(false);
  };
  const edit = p => { setForm({ caption: p.caption || "", phase: p.phase, date: p.date, driveLink: p.driveLink || "" }); setEditId(p.id); setModal(true); setVp(null); };
  const filtered = filter === "all" ? data.photos : data.photos.filter(p => p.phase === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <Card style={{ marginBottom: 14, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#C4B5FD", marginBottom: 3 }}>💡 Add photos via Google Drive</div>
        <div style={{ fontSize: 11, color: "#A78BFA", lineHeight: 1.6 }}>Upload to Drive → Share → "Anyone with link" → Paste here</div>
      </Card>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 10 }}>
        <button onClick={() => setFilter("all")} className="chip" style={{ background: filter === "all" ? "#F97316" : "#18181B", color: filter === "all" ? "#fff" : "#A1A1AA", border: "1px solid #27272A" }}>All ({data.photos.length})</button>
        {PHASES.map(p => { const c = data.photos.filter(ph => ph.phase === p).length; return <button key={p} onClick={() => setFilter(p)} className="chip" style={{ background: filter === p ? "#F97316" : "#18181B", color: filter === p ? "#fff" : "#A1A1AA", border: "1px solid #27272A" }}>{p}{c > 0 ? ` (${c})` : ""}</button>; })}
      </div>

      {sorted.length === 0 ? <Empty icon="📸" text="No photos yet." /> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {sorted.map((p, i) => (
            <Card key={p.id} delay={i} style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={() => setVp(p)}>
              <div style={{ width: "100%", height: 150, background: `url(${p.url}) center/cover`, backgroundColor: "#0A0A0A", position: "relative" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.85))", padding: "20px 10px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{p.caption || "Untitled"}</div>
                </div>
                <div style={{ position: "absolute", top: 8, right: 8 }}><Badge color="#fff">{p.phase}</Badge></div>
              </div>
              <div style={{ padding: "8px 12px" }}><div style={{ fontSize: 10, color: "#71717A" }}>{dateStr(p.date)}</div></div>
            </Card>
          ))}
        </div>
      )}

      {vp && (
        <Modal title={vp.caption || "Photo"} onClose={() => setVp(null)}>
          <img src={vp.url} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 14 }} onError={e => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 13, color: "#A1A1AA", marginBottom: 8 }}>{vp.phase} · {dateStr(vp.date)}</div>
          {vp.driveLink && <a href={getDriveOpen(vp.driveLink)} target="_blank" rel="noopener noreferrer" className="action-btn link-btn" style={{ marginBottom: 14 }}>📂 Open in Drive</a>}
          <div className="action-row">
            <button className="action-btn edit-btn" onClick={() => edit(vp)} style={{ flex: 1 }}>✏️ Edit</button>
            <button className="action-btn remove-btn" onClick={() => { setData(d => ({ ...d, photos: d.photos.filter(x => x.id !== vp.id) })); setVp(null); }} style={{ flex: 1 }}>🗑️ Delete</button>
          </div>
        </Modal>
      )}

      <button className="fab" onClick={() => { setForm(blank); setEditId(null); setModal(true); }}>+</button>
      {modal && (
        <Modal title={editId ? "Edit Photo" : "Add Photo"} onClose={() => { setModal(false); setEditId(null); }}>
          <div style={{ marginBottom: 16 }}>
            <label className="lbl">Google Drive Link</label>
            <input value={form.driveLink} onChange={e => setForm({ ...form, driveLink: e.target.value })} placeholder="Paste Drive share link..." className="inp" style={{ borderColor: "#F97316" }} />
            {form.driveLink && <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", background: "#0A0A0A" }}><img src={getDriveUrl(form.driveLink)} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /></div>}
          </div>
          <Inp label="Caption" value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} placeholder="e.g. Foundation east side" />
          <Sel label="Phase" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} options={PHASES.map(p => ({ value: p, label: p }))} />
          <Inp label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <button className="btn-p" onClick={save} disabled={!form.driveLink}>{editId ? "Save Changes" : "Add Photo"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── LABOUR ───
function LabourPanel({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { date: new Date().toISOString().split("T")[0], workers: "", masons: "", helpers: "", note: "" };
  const [form, setForm] = useState(blank);

  const save = () => {
    if (!form.workers) return;
    const entry = { ...form, workers: Number(form.workers) || 0, masons: Number(form.masons) || 0, helpers: Number(form.helpers) || 0 };
    if (editId) setData(d => ({ ...d, labour: d.labour.map(l => l.id === editId ? { ...entry, id: editId } : l) }));
    else setData(d => ({ ...d, labour: [...d.labour, { ...entry, id: Date.now() }] }));
    setForm(blank); setEditId(null); setModal(false);
  };
  const edit = l => { setForm({ date: l.date, workers: String(l.workers), masons: String(l.masons), helpers: String(l.helpers), note: l.note || "" }); setEditId(l.id); setModal(true); };
  const sorted = [...data.labour].sort((a, b) => new Date(b.date) - new Date(a.date));
  const td = sorted.length;
  const avg = td > 0 ? (sorted.reduce((s, l) => s + l.workers, 0) / td).toFixed(1) : 0;
  const tm = sorted.reduce((s, l) => s + l.workers, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[{ n: td, l: "Work Days" }, { n: avg, l: "Avg/Day" }, { n: tm, l: "Man-days" }].map(s => <Card key={s.l} style={{ textAlign: "center", padding: "12px 8px" }}><div style={{ fontSize: 22, fontWeight: 700, color: "#FAFAFA" }}>{s.n}</div><div style={{ fontSize: 10, color: "#71717A" }}>{s.l}</div></Card>)}
      </div>

      {sorted.length === 0 ? <Empty icon="👷" text="Track daily worker attendance." /> : sorted.map((l, i) => (
        <Card key={l.id} delay={i} style={{ padding: "14px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#FAFAFA" }}>{dateStr(l.date)}</div>
              <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 3 }}>{l.masons > 0 && `🧱 ${l.masons} masons  `}{l.helpers > 0 && `🔨 ${l.helpers} helpers`}</div>
              {l.note && <div style={{ fontSize: 11, color: "#71717A", marginTop: 3, fontStyle: "italic" }}>{l.note}</div>}
            </div>
            <div style={{ textAlign: "center", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 12, padding: "8px 14px" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#60A5FA" }}>{l.workers}</div>
              <div style={{ fontSize: 9, color: "#60A5FA", fontWeight: 600 }}>TOTAL</div>
            </div>
          </div>
          <Actions onEdit={() => edit(l)} onRemove={() => setData(d => ({ ...d, labour: d.labour.filter(x => x.id !== l.id) }))} />
        </Card>
      ))}

      <button className="fab" onClick={() => { setForm(blank); setEditId(null); setModal(true); }}>+</button>
      {modal && (
        <Modal title={editId ? "Edit Entry" : "Log Attendance"} onClose={() => { setModal(false); setEditId(null); }}>
          <Inp label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Inp label="Total Workers" type="number" value={form.workers} onChange={e => setForm({ ...form, workers: e.target.value })} placeholder="Total headcount" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Inp label="Masons" type="number" value={form.masons} onChange={e => setForm({ ...form, masons: e.target.value })} placeholder="0" />
            <Inp label="Helpers" type="number" value={form.helpers} onChange={e => setForm({ ...form, helpers: e.target.value })} placeholder="0" />
          </div>
          <Inp label="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Plastering started" />
          <button className="btn-p" onClick={save} disabled={!form.workers}>{editId ? "Save Changes" : "Log Attendance"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── TIMELINE ───
function TimelinePanel({ data, setData }) {
  const toggleDone = i => setData(d => { const ms = [...d.milestones]; ms[i] = { ...ms[i], done: !ms[i].done, actual: !ms[i].done ? new Date().toISOString().split("T")[0] : "" }; return { ...d, milestones: ms }; });
  const upd = (i, f, v) => setData(d => { const ms = [...d.milestones]; ms[i] = { ...ms[i], [f]: v }; return { ...d, milestones: ms }; });
  const done = data.milestones.filter(m => m.done).length;

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#A1A1AA" }}>Progress</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#FAFAFA" }}>{done}/{data.milestones.length}</span>
        </div>
        <div style={{ background: "#27272A", borderRadius: 6, height: 8, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${(done / data.milestones.length) * 100}%`, height: "100%", background: "#10B981", borderRadius: 6 }} /></div>
      </Card>
      <div style={{ position: "relative", paddingLeft: 30 }}>
        <div style={{ position: "absolute", left: 12, top: 8, bottom: 8, width: 2, background: "#27272A" }} />
        {data.milestones.map((m, i) => (
          <div key={m.phase} style={{ position: "relative", marginBottom: 8 }}>
            <div style={{ position: "absolute", left: -23, top: 16, width: 16, height: 16, borderRadius: 8, background: m.done ? "#10B981" : "#27272A", border: "3px solid #18181B", boxShadow: `0 0 0 2px ${m.done ? "#10B981" : "#3F3F46"}` }} />
            <Card delay={i} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#FAFAFA" }}>{m.phase}</span>
                <button onClick={() => toggleDone(i)} style={{ background: m.done ? "rgba(16,185,129,0.15)" : "#27272A", border: `1.5px solid ${m.done ? "#10B981" : "#3F3F46"}`, borderRadius: 8, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: m.done ? "#10B981" : "#71717A", fontFamily: "inherit" }}>{m.done ? "✓ Done" : "Mark Done"}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={{ fontSize: 10, color: "#71717A" }}>Planned</label><input type="date" value={m.planned} onChange={e => upd(i, "planned", e.target.value)} className="inp" style={{ padding: 8, fontSize: 12 }} /></div>
                <div><label style={{ fontSize: 10, color: "#71717A" }}>Actual</label><input type="date" value={m.actual} onChange={e => upd(i, "actual", e.target.value)} className="inp" style={{ padding: 8, fontSize: 12 }} /></div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CONTACTS ───
function ContactsPanel({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { name: "", role: "Contractor", phone: "", note: "" };
  const [form, setForm] = useState(blank);
  const roles = ["Contractor", "Architect", "Engineer", "Mason", "Electrician", "Plumber", "Carpenter", "Painter", "Supplier", "Interior Designer", "Other"];
  const ri = r => ({ Contractor: "🏗️", Architect: "📐", Engineer: "⚙️", Electrician: "⚡", Plumber: "🔧", Supplier: "🚛", Carpenter: "🪚", Painter: "🎨" })[r] || "👤";

  const save = () => {
    if (!form.name) return;
    if (editId) setData(d => ({ ...d, contacts: d.contacts.map(c => c.id === editId ? { ...form, id: editId } : c) }));
    else setData(d => ({ ...d, contacts: [...d.contacts, { ...form, id: Date.now() }] }));
    setForm(blank); setEditId(null); setModal(false);
  };
  const edit = c => { setForm({ name: c.name, role: c.role, phone: c.phone || "", note: c.note || "" }); setEditId(c.id); setModal(true); };

  return (
    <div>
      {data.contacts.length === 0 ? <Empty icon="📞" text="No contacts added yet." /> : data.contacts.map((c, i) => (
        <Card key={c.id} delay={i} style={{ padding: "14px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "#27272A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, border: "1px solid #3F3F46" }}>{ri(c.role)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#FAFAFA" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#71717A", marginTop: 1 }}>{c.role}</div>
                {c.phone && <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>{c.phone}</div>}
                {c.note && <div style={{ fontSize: 11, color: "#71717A", marginTop: 2, fontStyle: "italic" }}>{c.note}</div>}
              </div>
            </div>
            {c.phone && <a href={`tel:${c.phone}`} style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(16,185,129,0.3)" }}>📞</a>}
          </div>
          <Actions onEdit={() => edit(c)} onRemove={() => setData(d => ({ ...d, contacts: d.contacts.filter(x => x.id !== c.id) }))} />
        </Card>
      ))}

      <button className="fab" onClick={() => { setForm(blank); setEditId(null); setModal(true); }}>+</button>
      {modal && (
        <Modal title={editId ? "Edit Contact" : "Add Contact"} onClose={() => { setModal(false); setEditId(null); }}>
          <Inp label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Raju Kumar" />
          <Sel label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={roles.map(r => ({ value: r, label: r }))} />
          <Inp label="Phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
          <Inp label="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Available weekdays" />
          <button className="btn-p" onClick={save} disabled={!form.name}>{editId ? "Save Changes" : "Add Contact"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── CHECKLIST ───
function ChecklistPanel({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [linkModal, setLinkModal] = useState(null);
  const [docLink, setDocLink] = useState("");
  const blank = { item: "", category: "Legal" };
  const [form, setForm] = useState(blank);

  const toggle = id => setData(d => ({ ...d, checklist: d.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c) }));
  const save = () => {
    if (!form.item) return;
    if (editId) setData(d => ({ ...d, checklist: d.checklist.map(c => c.id === editId ? { ...c, item: form.item, category: form.category } : c) }));
    else setData(d => ({ ...d, checklist: [...d.checklist, { ...form, id: Date.now(), done: false, docLink: "" }] }));
    setForm(blank); setEditId(null); setModal(false);
  };
  const saveLink = () => {
    if (!linkModal) return;
    setData(d => ({ ...d, checklist: d.checklist.map(c => c.id === linkModal ? { ...c, docLink } : c) }));
    setLinkModal(null); setDocLink("");
  };
  const edit = c => { setForm({ item: c.item, category: c.category }); setEditId(c.id); setModal(true); };
  const done = data.checklist.filter(c => c.done).length;
  const cats = [...new Set(data.checklist.map(c => c.category))];

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#A1A1AA" }}>Completed</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: done === data.checklist.length ? "#10B981" : "#FAFAFA" }}>{done}/{data.checklist.length}</span>
        </div>
        <div style={{ background: "#27272A", borderRadius: 6, height: 8, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${data.checklist.length > 0 ? (done / data.checklist.length) * 100 : 0}%`, height: "100%", background: "#10B981", borderRadius: 6 }} /></div>
      </Card>

      <Card style={{ marginBottom: 14, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#C4B5FD", marginBottom: 3 }}>📎 Attach permit PDFs via Google Drive</div>
        <div style={{ fontSize: 11, color: "#A78BFA", lineHeight: 1.6 }}>Upload PDF to Drive → Share → Tap "📎 Link" on any item</div>
      </Card>

      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#71717A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>{cat}</div>
          {data.checklist.filter(c => c.category === cat).map((c, i) => (
            <Card key={c.id} delay={i} style={{ padding: "12px 16px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div onClick={() => toggle(c.id)} style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${c.done ? "#10B981" : "#3F3F46"}`, background: c.done ? "#10B981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0, cursor: "pointer", marginTop: 2 }}>{c.done ? "✓" : ""}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, textDecoration: c.done ? "line-through" : "none", opacity: c.done ? 0.5 : 1, color: "#FAFAFA" }}>{c.item}</span>
                  {c.docLink && <div style={{ marginTop: 6 }}><a href={getDriveOpen(c.docLink)} target="_blank" rel="noopener noreferrer" className="action-btn link-btn">📄 View Document</a></div>}
                  <div className="action-row" style={{ marginTop: 8 }}>
                    <button className="action-btn link-btn" onClick={() => { setDocLink(c.docLink || ""); setLinkModal(c.id); }}>📎 {c.docLink ? "Update" : "Add"} Link</button>
                    <button className="action-btn edit-btn" onClick={() => edit(c)}>✏️</button>
                    <button className="action-btn remove-btn" onClick={() => setData(d => ({ ...d, checklist: d.checklist.filter(x => x.id !== c.id) }))}>🗑️</button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}

      <button className="fab" onClick={() => { setForm(blank); setEditId(null); setModal(true); }}>+</button>
      {modal && (
        <Modal title={editId ? "Edit Item" : "Add Item"} onClose={() => { setModal(false); setEditId(null); }}>
          <Inp label="Document / Task" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g. Completion certificate" />
          <Sel label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={["Legal", "Permits", "Pre-construction", "Planning", "Utilities", "Finance", "Insurance", "Other"].map(c => ({ value: c, label: c }))} />
          <button className="btn-p" onClick={save} disabled={!form.item}>{editId ? "Save Changes" : "Add Item"}</button>
        </Modal>
      )}
      {linkModal && (
        <Modal title="Attach Document" onClose={() => setLinkModal(null)}>
          <Inp label="Google Drive Link" value={docLink} onChange={e => setDocLink(e.target.value)} placeholder="Paste Drive link..." />
          <button className="btn-p" onClick={saveLink}>Save Link</button>
        </Modal>
      )}
    </div>
  );
}

// ─── EXPORT ───
function ExportPanel({ data }) {
  const totalSpent = data.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const remaining = data.budget - totalSpent;

  const generatePrint = () => {
    const catTotals = EXPENSE_CATS.map(c => ({ ...c, total: data.expenses.filter(e => e.category === c.key).reduce((s, e) => s + Number(e.amount || 0), 0) }));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.projectName} Report</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:30px;color:#1C1917;font-size:13px;line-height:1.6}
      h1{font-size:24px;margin-bottom:4px;color:#000}
      h2{font-size:16px;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #ddd;color:#333}
      .sub{color:#666;font-size:12px;margin-bottom:20px}
      .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px}
      .box{background:#f5f5f5;padding:14px;border-radius:8px;text-align:center}
      .box .num{font-size:20px;font-weight:700}.box .lbl{font-size:10px;color:#666;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
      th{background:#000;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase}
      td{padding:8px 12px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
      .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
      @media print{body{padding:15px}}
    </style></head><body>
    <h1>🏠 ${data.projectName || "Home Construction"}</h1>
    <div class="sub">Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · Phase: ${data.currentPhase}</div>
    <div class="grid">
      <div class="box"><div class="num">${fmt(data.budget)}</div><div class="lbl">Budget</div></div>
      <div class="box"><div class="num">${fmt(totalSpent)}</div><div class="lbl">Spent</div></div>
      <div class="box"><div class="num" style="color:${remaining < 0 ? '#B91C1C' : '#047857'}">${fmt(remaining)}</div><div class="lbl">Remaining</div></div>
    </div>
    <h2>💰 Expenses (${data.expenses.length})</h2>
    ${data.expenses.length > 0 ? `<table><tr><th>Date</th><th>Description</th><th>Category</th><th>Mode</th><th>Amount</th><th>Status</th></tr>
    ${[...data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => { const cat = EXPENSE_CATS.find(c => c.key === e.category); const pm = PAY_MODES.find(m => m.val === e.payMode); return `<tr><td>${dateStr(e.date)}</td><td>${e.desc}${e.note ? `<br><i>${e.note}</i>` : ""}</td><td>${cat ? cat.label : ""}</td><td>${pm ? pm.label : ""}</td><td><b>${fmt(e.amount)}</b></td><td>${e.paid ? "Paid" : "Pending"}</td></tr>`; }).join("")}</table>` : "<p>No expenses.</p>"}
    <h2>📦 Materials (${data.stock.length})</h2>
    ${data.stock.length > 0 ? `<table><tr><th>Material</th><th>Bought</th><th>Used</th><th>Left</th><th>Supplier</th><th>Status</th></tr>
    ${data.stock.map(s => { const st = STOCK_STATUS[s.status]; return `<tr><td><b>${s.item}</b></td><td>${s.qty} ${s.unit}</td><td>${s.used}</td><td><b>${s.qty - s.used}</b></td><td>${s.supplier || "-"}</td><td>${st.label}</td></tr>`; }).join("")}</table>` : "<p>No materials.</p>"}
    <h2>👷 Labour (${data.labour.length} days)</h2>
    ${data.labour.length > 0 ? `<table><tr><th>Date</th><th>Workers</th><th>Masons</th><th>Helpers</th><th>Note</th></tr>
    ${[...data.labour].sort((a, b) => new Date(b.date) - new Date(a.date)).map(l => `<tr><td>${dateStr(l.date)}</td><td><b>${l.workers}</b></td><td>${l.masons}</td><td>${l.helpers}</td><td>${l.note || "-"}</td></tr>`).join("")}</table>` : "<p>No records.</p>"}
    <h2>📅 Timeline</h2>
    <table><tr><th>Phase</th><th>Planned</th><th>Actual</th><th>Status</th></tr>
    ${data.milestones.map(m => `<tr><td><b>${m.phase}</b></td><td>${dateStr(m.planned) || "-"}</td><td>${dateStr(m.actual) || "-"}</td><td>${m.done ? "✓ Done" : "Pending"}</td></tr>`).join("")}</table>
    <h2>📞 Contacts (${data.contacts.length})</h2>
    ${data.contacts.length > 0 ? `<table><tr><th>Name</th><th>Role</th><th>Phone</th><th>Note</th></tr>
    ${data.contacts.map(c => `<tr><td><b>${c.name}</b></td><td>${c.role}</td><td>${c.phone || "-"}</td><td>${c.note || "-"}</td></tr>`).join("")}</table>` : "<p>No contacts.</p>"}
    <h2>✅ Documents</h2>
    <table><tr><th>Item</th><th>Category</th><th>Status</th><th>Document</th></tr>
    ${data.checklist.map(c => `<tr><td>${c.item}</td><td>${c.category}</td><td>${c.done ? "Done" : "Pending"}</td><td>${c.docLink ? '<a href="' + getDriveOpen(c.docLink) + '">View</a>' : "-"}</td></tr>`).join("")}</table>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  return (
    <div>
      <Card glow style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>📄</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif", marginBottom: 8, color: "#FAFAFA" }}>Export Report</div>
        <div style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 24 }}>Complete PDF with all expenses, materials, labour, timeline, contacts and documents.</div>
        <button className="btn-p" onClick={generatePrint}>📥 Download PDF Report</button>
        <div style={{ fontSize: 11, color: "#71717A", marginTop: 12 }}>Opens print dialog → Save as PDF</div>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 600 }}>Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ l: "Budget", v: fmt(data.budget), i: "💰" }, { l: "Spent", v: fmt(totalSpent), i: "📊" }, { l: "Expenses", v: data.expenses.length, i: "💳" }, { l: "Materials", v: data.stock.length, i: "📦" }, { l: "Labour Days", v: data.labour.length, i: "👷" }, { l: "Contacts", v: data.contacts.length, i: "📞" }].map(s => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <span style={{ fontSize: 18 }}>{s.i}</span>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: "#FAFAFA" }}>{s.v}</div><div style={{ fontSize: 10, color: "#71717A" }}>{s.l}</div></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [tab, setTab] = useState("overview");
  const [data, setDataRaw] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const docRef = doc(db, "projects", PROJECT_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setDataRaw({ ...DEFAULT_DATA, ...docSnap.data() });
      } else {
        setDoc(docRef, DEFAULT_DATA);
        setDataRaw(DEFAULT_DATA);
      }
      setLoaded(true);
    }, (error) => {
      console.error("Firebase error:", error);
      setLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const setData = useCallback((updater) => {
    setDataRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSaving(true);
      setDoc(doc(db, "projects", PROJECT_DOC_ID), next)
        .then(() => setTimeout(() => setSaving(false), 800))
        .catch(() => setSaving(false));
      return next;
    });
  }, []);

  if (!loaded) return (
    <>
      <style>{STYLES}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0A0A" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56, animation: "pulse 1.5s infinite" }}>🏠</div>
          <div style={{ fontSize: 14, color: "#71717A", marginTop: 14 }}>Syncing...</div>
        </div>
      </div>
    </>
  );

  const panels = {
    overview: <OverviewPanel data={data} setData={setData} setTab={setTab} />,
    expenses: <ExpensesPanel data={data} setData={setData} />,
    stock: <StockPanel data={data} setData={setData} />,
    photos: <PhotosPanel data={data} setData={setData} />,
    labour: <LabourPanel data={data} setData={setData} />,
    timeline: <TimelinePanel data={data} setData={setData} />,
    contacts: <ContactsPanel data={data} setData={setData} />,
    checklist: <ChecklistPanel data={data} setData={setData} />,
    export: <ExportPanel data={data} />
  };
  const ct = TABS.find(t => t.key === tab);

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#71717A", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>🏠 {data.projectName || "My Home"}</div>
              <h1 style={{ margin: "3px 0 0", color: "#FAFAFA", fontSize: 22, fontFamily: "'Playfair Display',serif", fontWeight: 500 }}>{ct?.icon} {ct?.label}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {saving && <div style={{ fontSize: 10, color: "#F97316" }}><span style={{ animation: "pulse 1s infinite" }}>●</span> Saving</div>}
              <button onClick={() => { if (window.confirm("Delete ALL data for EVERYONE?")) setData(DEFAULT_DATA); }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "5px 10px", color: "#FCA5A5", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 14px 0" }}>{panels[tab]}</div>

        <div className="bnav">
          <div style={{ display: "flex", maxWidth: 500, width: "100%", justifyContent: "space-around" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className="nb" style={{ color: tab === t.key ? "#F97316" : "#71717A" }}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: tab === t.key ? 700 : 500, letterSpacing: 0.3 }}>{t.label}</span>
                {tab === t.key && <div style={{ width: 5, height: 5, borderRadius: 3, background: "#F97316", marginTop: 2 }} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
