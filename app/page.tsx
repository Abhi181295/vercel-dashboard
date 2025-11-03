'use client';

import { useEffect, useMemo, useState } from 'react';

/** ======================================================================
 * Live hierarchy from /api/revenue
 * - Service / Commerce toggle
 * - Yesterday / WTD / MTD
 * - SM → Manager → AM/FLAP collapsible
 * UI: clean light CRM (sidebar + sticky header)
 * ====================================================================== */

type Metric = { achieved: number; target: number; pct: number };
type Block = { y: Metric; w: Metric; m: Metric };

type Leaf = {
  id: string;
  name: string;
  role: 'AM' | 'FLAP';
  service: Block;
  commerce: Block;
};

type Manager = {
  id: string;
  name: string;
  role: 'M';
  service: Block;
  commerce: Block;
  children: Leaf[];
};

type SM = {
  id: string;
  name: string;
  role: 'SM';
  service: Block;
  commerce: Block;
  children: Manager[];
};

function fmt(n: number) {
  return n.toLocaleString('en-IN');
}

export default function Page() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Fitelo SM Dashboard';
  const [revType, setRevType] = useState<'service' | 'commerce'>('service');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [data, setData] = useState<SM[]>([]);
  const [error, setError] = useState<string | null>(null);

  // fetch data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/revenue', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) {
          if (json.ok) {
            setData(json.data || []);
            setLastFetched(json.lastFetched || null);
          } else {
            setError(json.error || 'Failed to fetch');
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    const keepLeaf = (l: Leaf) => l.name.toLowerCase().includes(q) || l.role.toLowerCase().includes(q);
    const keepMgr = (m: Manager) =>
      m.name.toLowerCase().includes(q) || m.children.some(keepLeaf);
    const keepSM = (s: SM) =>
      s.name.toLowerCase().includes(q) || s.children.some(keepMgr);

    return data
      .filter(keepSM)
      .map((s) => ({
        ...s,
        children: s.children
          .filter(keepMgr)
          .map((m) => ({ ...m, children: m.children.filter(keepLeaf) })),
      }));
  }, [data, search]);

  function toggle(id: string, open?: boolean) {
    setExpanded((prev) => ({ ...prev, [id]: typeof open === 'boolean' ? open : !prev[id] }));
  }

  function expandAll(open: boolean) {
    const all: Record<string, boolean> = {};
    const walk = (s: SM) => {
      all[s.id] = open;
      s.children.forEach((m) => {
        all[m.id] = open;
        m.children.forEach((l) => (all[l.id] = open));
      });
    };
    filtered.forEach(walk);
    setExpanded(all);
  }

  return (
    <div className="crm-root">
      {/* Sidebar */}
      <aside className="crm-aside">
        <div className="brand">
          <span className="brand-main">Fitelo</span>{' '}
          <span className="brand-sub">SM Dashboard</span>
          <span className="zap">⚡</span>
        </div>

        <nav className="nav">
          <a className="nav-item">
            <span className="i">🏠</span> Dashboard
          </a>
          <a className="nav-item active">
            <span className="i">👥</span> Revenue
          </a>
          <a className="nav-item">
            <span className="i">✅</span> Quality
          </a>
          <a className="nav-item">
            <span className="i">🛠️</span> Issues
          </a>
          <a className="nav-item">
            <span className="i">📊</span> Analytics
          </a>
        </nav>

        <button
          className="logout"
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' });
            location.href = '/login';
          }}
        >
          ⎋ Logout
        </button>
      </aside>

      {/* Main */}
      <section className="crm-main">
        <header className="top">
          <div>
            <h1 className="title">Revenue Management</h1>
            <p className="subtitle">
              Track SM → Manager → AM/FLAP with clear targets
              {lastFetched ? (
                <span className="lastf"> • Last fetched: {new Date(lastFetched).toLocaleString()}</span>
              ) : null}
            </p>
          </div>

        <div className="actions">
            <button className="btn" onClick={() => location.reload()} title="Refresh">⟲ Refresh</button>
            <button className="btn" title="Export CSV" onClick={() => alert('Export wiring next')}>
              ⬇ Export CSV
            </button>
            <button className="btn" title="Show Filters" onClick={() => alert('Filters coming soon')}>
              ⚲ Show Filters
            </button>
          </div>
        </header>

        {/* Search */}
        <div className="searchbar">
          <input
            className="search"
            placeholder="Search by name or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => setSearch('')}>Clear</button>
        </div>

        {/* Revenue type toggle */}
        <div className="rev-toggle">
          <button
            className={`rev-pill ${revType === 'service' ? 'active' : ''}`}
            onClick={() => setRevType('service')}
            title="Show Service revenue metrics"
          >
            Service Revenue
          </button>
          <button
            className={`rev-pill ${revType === 'commerce' ? 'active' : ''}`}
            onClick={() => setRevType('commerce')}
            title="Show Commerce revenue metrics"
          >
            Commerce Revenue
          </button>
        </div>

        {/* Extra controls */}
        <div className="row-controls">
          <div className="chips">
            <span className="chip">Yesterday</span>
            <span className="sep">•</span>
            <span className="chip">WTD</span>
            <span className="sep">•</span>
            <span className="chip">MTD</span>
          </div>

          <label className="expand">
            <input type="checkbox" onChange={(e) => expandAll(e.target.checked)} /> Expand all levels
          </label>
        </div>

        {/* States */}
        {loading && <div className="state">Loading…</div>}
        {error && <div className="state err">Error: {error}</div>}

        {/* Table */}
        {!loading && !error && (
          <div className="card">
            {/* Polished sticky header */}
            <div className="thead sticky">
              <div className="h-name">
                <div className="h-title">Name</div>
                <div className="h-sub">SM → Manager → AM/FLAP</div>
              </div>

              <div className="h-role">
                <div className="h-title">Role</div>
                <div className="h-sub">Org level</div>
              </div>

              <div className="h-group">
                <div className="g-title">Yesterday</div>
                <div className="g-sub">
                  <span>Achieved</span><span>Target</span><span>%</span>
                </div>
              </div>

              <div className="h-group">
                <div className="g-title">WTD</div>
                <div className="g-sub">
                  <span>Achieved</span><span>Target</span><span>%</span>
                </div>
              </div>

              <div className="h-group">
                <div className="g-title">MTD</div>
                <div className="g-sub">
                  <span>Achieved</span><span>Target</span><span>%</span>
                </div>
              </div>
            </div>

            <div className="tbody">
              {filtered.map((sm) => (
                <RowSM key={sm.id} node={sm} expanded={expanded} onToggle={toggle} revType={revType} />
              ))}
            </div>
          </div>
        )}
      </section>

      <style jsx global>{CSS}</style>
    </div>
  );
}

/* ----------------------------- Rows ---------------------------------- */

type Pickable = { service: Block; commerce: Block };
function pick(blocks: Pickable, revType: 'service' | 'commerce'): Block {
  return revType === 'service' ? blocks.service : blocks.commerce;
}

type RowSMProps = {
  node: SM;
  expanded: Record<string, boolean>;
  onToggle: (id: string, open?: boolean) => void;
  revType: 'service' | 'commerce';
};

function RowSM({ node, expanded, onToggle, revType }: RowSMProps) {
  const open = !!expanded[node.id];
  const blk = pick(node, revType);
  return (
    <>
      <div className="row">
        <div className="c-name">
          <button className="caret" onClick={() => onToggle(node.id)}>
            <span className={`arrow ${open ? 'open' : ''}`} />
          </button>
          <span className="nm">{node.name}</span>
          <span className="badge sm">SM</span>
        </div>
        <div className="c-role">Senior Manager</div>

        <Metrics m={blk.y} />
        <Metrics m={blk.w} />
        <Metrics m={blk.m} />
      </div>

      {open &&
        node.children.map((m) => (
          <RowMgr key={m.id} node={m} expanded={expanded} onToggle={onToggle} revType={revType} />
        ))}
    </>
  );
}

type RowMgrProps = {
  node: Manager;
  expanded: Record<string, boolean>;
  onToggle: (id: string, open?: boolean) => void;
  revType: 'service' | 'commerce';
};

function RowMgr({ node, expanded, onToggle, revType }: RowMgrProps) {
  const open = !!expanded[node.id];
  const blk = pick(node, revType);
  return (
    <>
      <div className="row mgr">
        <div className="c-name">
          <span className="indent guide" />
          <button className="caret" onClick={() => onToggle(node.id)}>
            <span className={`arrow ${open ? 'open' : ''}`} />
          </button>
          <span className="nm">{node.name}</span>
          <span className="badge m">M</span>
        </div>
        <div className="c-role">Manager</div>

        <Metrics m={blk.y} />
        <Metrics m={blk.w} />
        <Metrics m={blk.m} />
      </div>

      {open && node.children.map((l) => <RowLeaf key={l.id} node={l} revType={revType} />)}
    </>
  );
}

function RowLeaf({ node, revType }: { node: Leaf; revType: 'service' | 'commerce' }) {
  const blk = pick(node, revType);
  return (
    <div className="row leaf">
      <div className="c-name">
        <span className="indent guide" />
        <span className="indent guide deeper" />
        <span className="dot" />
        <span className="nm">{node.name}</span>
        <span className={`badge ${node.role === 'AM' ? 'am' : 'flap'}`}>{node.role}</span>
      </div>
      <div className="c-role">{node.role === 'AM' ? 'Assistant Manager' : 'FLAP'}</div>

      <Metrics m={blk.y} />
      <Metrics m={blk.w} />
      <Metrics m={blk.m} />
    </div>
  );
}

function Metrics({ m }: { m: Metric }) {
  return (
    <div className="grp">
      <div className="nums">
        <div className="n">{fmt(m.achieved)}</div>
        <div className="n">{fmt(m.target)}</div>
        <div className={`n pct ${m.pct >= 100 ? 'good' : 'warn'}`}>{m.pct}%</div>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${Math.min(m.pct, 100)}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------ CSS ---------------------------------- */

const CSS = `
:root{
  --bg:#f8fafc;
  --card:#ffffff;
  --line:#e5e7eb;
  --line2:#eef0f3;
  --muted:#64748b;
  --text:#0f172a;
  --good:#16a34a;
  --warn:#f59e0b;
}

*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}

.crm-root{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
.crm-aside{background:#ffffff;border-right:1px solid var(--line);padding:18px 16px;display:flex;flex-direction:column}
.brand{font-weight:700;font-size:18px;margin:4px 6px 14px}
.brand-main{color:#111827}
.brand-sub{color:#f97316;margin-left:6px}
.zap{margin-left:6px}

.nav{display:flex;flex-direction:column;gap:4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:10px;color:#0f172a;text-decoration:none;cursor:pointer}
.nav-item:hover{background:#f3f4f6}
.nav-item.active{background:#eef2ff}

.logout{margin-top:auto;border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 12px;cursor:pointer}
.logout:hover{background:#f8fafc}

.crm-main{padding:18px 22px 40px;display:flex;flex-direction:column;gap:16px}
.top{display:flex;justify-content:space-between;align-items:center}
.title{margin:0 0 4px 0}
.subtitle{margin:0;color:var(--muted)}
.lastf{color:#9aa6b2}
.actions{display:flex;gap:8px}
.btn{background:#0f172a;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer}
.btn:hover{opacity:.9}
.btn-secondary{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
.btn-secondary:hover{background:#f8fafc}

.searchbar{display:flex;gap:8px;align-items:center}
.search{flex:1;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;outline:none}
.search:focus{border-color:#cbd5e1}

/* Revenue toggle pills */
.rev-toggle{display:flex;gap:8px;align-items:center;margin:8px 0 4px}
.rev-pill{background:#fff;border:1px solid var(--line);color:#0f172a;padding:8px 14px;border-radius:999px;cursor:pointer;box-shadow:0 1px 0 rgba(15,23,42,.04)}
.rev-pill.active{background:#0f172a;color:#fff;border-color:#0f172a}

.row-controls{display:flex;justify-content:space-between;align-items:center}
.chips{display:flex;align-items:center;gap:8px}
.chip{background:#f3f4f6;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12px;color:#111827}
.sep{color:#cbd5e1}
.expand{font-size:13px;color:var(--muted)}

/* Table card */
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}

/* Sticky polished header */
.thead,.row{display:grid;grid-template-columns:minmax(260px,1fr) 160px repeat(3, 1fr)}
.thead.sticky{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,#ffffff,#fbfbfb);border-bottom:1px solid var(--line2);box-shadow:0 1px 0 rgba(15,23,42,.04)}
.h-name,.h-role,.h-group{padding:10px 12px}
.h-title{font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#111827;font-weight:700}
.h-sub{font-size:12px;color:#94a3b8;margin-top:2px}
.h-group .g-title{font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#111827;font-weight:700;margin-bottom:4px}
.h-group .g-sub{display:grid;grid-template-columns:1fr 1fr 60px;gap:12px;font-size:12px;color:#94a3b8}

/* Rows */
.tbody{display:flex;flex-direction:column}
.row{padding:10px 12px;align-items:center;border-bottom:1px solid var(--line2);transition:background .12s ease}
.row:hover{background:#fafbfd}
.row.mgr .c-name{padding-left:20px}
.row.leaf .c-name{padding-left:40px}

.c-name{display:flex;align-items:center;gap:10px}
.c-role{color:#64748b}

.caret{width:28px;height:28px;border:1px solid var(--line);background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.arrow{width:0;height:0;border-left:6px solid #6b7280;border-top:5px solid transparent;border-bottom:5px solid transparent;transition:transform .16s ease}
.arrow.open{transform:rotate(90deg)}
.nm{font-weight:600}

.grp{padding:0 10px}
.nums{display:grid;grid-template-columns:1fr 1fr 60px;gap:12px;align-items:center}
.n{font-weight:600}
.n.pct{justify-self:end}
.n.pct.warn{color:var(--warn)}
.n.pct.good{color:var(--good)}
.bar{height:6px;background:#f3f6f9;border:1px solid #e5eaf1;border-radius:8px;margin-top:6px;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#86efac,#60a5fa)}

/* Badges & guides */
.badge{font-size:11px;border-radius:999px;padding:4px 10px;border:1px solid var(--line)}
.badge.sm{background:#ecfdf5}
.badge.m{background:#eef2ff}
.badge.am{background:#fff7ed}
.badge.flap{background:#fffdea}

.indent{position:relative}
.guide::after{content:"";position:absolute;left:-12px;top:-12px;bottom:-12px;border-left:1px dashed #dbe1ea}
.guide.deeper::after{left:-22px}
.dot{width:8px;height:8px;border-radius:999px;background:#9ca3af;border:1px solid #d1d5db}

.state{padding:10px 12px;background:#fff;border:1px solid var(--line);border-radius:10px}
.state.err{border-color:#fecaca;background:#fff1f2}
`;
