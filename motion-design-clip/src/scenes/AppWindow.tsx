import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Home, Search, Building, Bookmark, History, FileText, Play, List, ChartLine, OctagonAlert, Check, X, ShieldCheck, CircleStop } from "lucide-react";
import { C, fontFamily, ip, easeInOut, easeOut, GLASS, GLASS_STRONG } from "../lib";
import { AGENT_ICONS, BrowserWindow, ClickRing, Cursor, DarkPill, Src, TitlePill } from "../ui";
import { LANES, FLAG_MS, CUT_MS } from "../run-data";

/**
 * Scenes 4 to 7 in one floating browser window (15.45 s to 44.6 s), so the app stays one object while the camera
 * moves: New research (questionnaire), the run (orbit), the Timeline, the Report, the results list and the candidate
 * page. Every number is from the recorded Office in Beograd run (material/recorded-run).
 */
export const APP_FROM = 15.45;
export const APP_TO = 44.6;
const W = 1600;
const H = 940;
const CW = 1600;
const CH = 882;

// ---- camera keyframes: [time, scale, focusX, focusY (content px from centre), rotX, rotY]
type K = [number, number, number, number, number, number];
const CAM: K[] = [
  [15.45, 0.86, 0, 0, 9, -14],
  [15.95, 0.94, 0, 0, 7, -10],
  [16.6, 1.32, -330, -120, 4, -6],
  [18.6, 1.36, -330, 60, 3, -4],
  [19.6, 1.32, -330, 150, 3, -4],
  [20.4, 1.38, 190, -60, 2, 3],
  [21.1, 1.42, 190, -60, 2, 3],
  [21.55, 1.12, 0, -30, 4, 0],
  [24.6, 1.22, 0, -30, 3, 2],
  [25.3, 1.55, 200, -40, 0, 0],
  [26.2, 1.6, 200, -40, 0, 0],
  [27.05, 1.75, 90, -230, 0, 0],
  [28.25, 1.8, 90, -230, 0, 0],
  [28.7, 0.98, 0, 0, 3, -4],
  [29.8, 1.0, 0, 0, 3, -4],
  [30.35, 1.6, -160, -110, 0, 0],
  [31.05, 1.6, -160, -110, 0, 0],
  [31.4, 1.06, 0, 0, 2, 4],
  [33.0, 1.12, 0, 0, 2, 3],
  [33.6, 1.32, 0, 60, 0, 0],
  [35.1, 1.34, 0, 60, 0, 0],
  [35.5, 0.98, 0, 0, 5, -6],
  [37.1, 1.0, 0, -40, 4, -4],
  [37.75, 1.05, 0, 0, 3, -3],
  [38.4, 1.35, 120, -260, 0, 0],
  [38.9, 1.35, 120, -260, 0, 0],
  [39.5, 1.55, 0, 170, 0, 0],
  [40.9, 1.58, 0, 170, 0, 0],
  [41.5, 1.5, -480, 150, 0, 0],
  [42.6, 1.52, -480, 170, 0, 0],
  [43.2, 1.5, 480, 150, 0, 0],
  [44.1, 1.52, 480, 170, 0, 0],
  [44.6, 0.7, 0, 0, 10, 10],
];

function camAt(t: number) {
  let i = 0;
  while (i < CAM.length - 2 && t > CAM[i + 1][0]) i++;
  const a = CAM[i];
  const b = CAM[i + 1];
  const p = ip(t, [a[0], b[0]], [0, 1], easeInOut);
  const m = (k: number) => a[k] + (b[k] - a[k]) * p;
  return { scale: m(1), fx: m(2), fy: m(3), rx: m(4), ry: m(5) };
}

/** visible from a to b (global seconds) with short fades */
const vis = (t: number, a: number, b: number, fade = 0.12) => Math.min(ip(t, [a, a + fade], [0, 1]), 1 - ip(t, [b - fade, b], [0, 1]));

const text = (size: number, weight = 400, color: string = C.ink): React.CSSProperties => ({ fontFamily, fontSize: size, fontWeight: weight, color });

// ---------------------------------------------------------------------------------------------------------------

const Sidebar: React.FC<{ active: number }> = ({ active }) => {
  const items = [
    { icon: Home, label: "Home" },
    { icon: Search, label: "Research" },
    { icon: Building, label: "Listings" },
    { icon: Bookmark, label: "My spaces" },
    { icon: History, label: "History" },
  ];
  return (
    <div style={{ position: "absolute", left: 16, top: 16, bottom: 16, width: 92, borderRadius: 32, ...GLASS_STRONG, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 18, gap: 16 }}>
      <Img src={staticFile("img/suitespot-logo.svg")} style={{ width: 56, height: 56, marginBottom: 6 }} />
      {items.map((it, i) => {
        const Icon = it.icon;
        const on = i === active;
        return (
          <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{ width: 46, height: 46, borderRadius: 99, background: on ? C.brandSoft : "white", display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(90,46,80,0.06)" }}>
              <Icon size={20} color={on ? "white" : C.ink} strokeWidth={2} />
            </div>
            <div style={text(12, on ? 600 : 500, C.ink2)}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const PageTitle: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ position: "absolute", left: 134, top: 22, ...text(34, 600), letterSpacing: "-0.025em" }}>{title}</div>
);

const Field: React.FC<{ label: string; value: string; t: number; at: number; dur?: number; w: number; x: number; y: number }> = ({ label, value, t, at, dur = 0.45, w, x, y }) => {
  const n = Math.round(ip(t, [at, at + dur], [0, value.length], (v) => v));
  const typing = t >= at - 0.15 && t <= at + dur + 0.35;
  const shown = value.slice(0, n);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      <div style={{ ...text(15, 500, C.ink2), marginBottom: 7 }}>{label}</div>
      <div
        style={{
          height: 48,
          borderRadius: 99,
          background: "rgba(255,255,255,0.78)",
          boxShadow: typing ? `0 0 0 3px ${C.brandSoft}` : "inset 0 0 0 1px rgba(255,255,255,0.9)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          ...text(18, 500),
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {shown}
        {typing ? <span style={{ width: 2, height: 22, background: C.ink, marginLeft: 2, opacity: Math.floor(t * 4) % 2 ? 1 : 0.2 }} /> : null}
      </div>
    </div>
  );
};

// ---- Scene 4: New research -----------------------------------------------------------------------------------
const NewResearch: React.FC<{ t: number }> = ({ t }) => {
  const click = 20.72;
  const pressed = ip(t, [click - 0.06, click], [0, 1]) * (1 - ip(t, [click + 0.08, click + 0.22], [0, 1]));
  const cx = ip(t, [19.75, 20.6], [1180, 990], easeInOut);
  const cy = ip(t, [19.75, 20.6], [640, 382], easeInOut);
  return (
    <AbsoluteFill>
      <Sidebar active={1} />
      <PageTitle title="New research" />
      {/* the two mode cards */}
      <div style={{ position: "absolute", left: 134, top: 82, width: 690, height: 82, borderRadius: 24, ...GLASS_STRONG, boxShadow: `inset 0 0 0 2.5px ${C.brandSoft}`, display: "flex", alignItems: "center", gap: 16, padding: "0 22px" }}>
        <div style={{ width: 46, height: 46, borderRadius: 99, background: C.brandSoft, display: "grid", placeItems: "center" }}>
          <Search size={20} color={C.ink} />
        </div>
        <div>
          <div style={text(19, 600)}>Find spaces</div>
          <div style={text(15, 400, C.ink2)}>SuiteSpot finds the spaces that fit your business</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 840, top: 82, width: 690, height: 82, borderRadius: 24, ...GLASS, display: "flex", alignItems: "center", gap: 16, padding: "0 22px" }}>
        <div style={{ width: 46, height: 46, borderRadius: 99, background: "white", display: "grid", placeItems: "center" }}>
          <FileText size={20} color={C.ink} />
        </div>
        <div>
          <div style={text(19, 600)}>Evaluate a space</div>
          <div style={text(15, 400, C.ink2)}>One space, from SuiteSpot or found elsewhere</div>
        </div>
      </div>
      {/* Your business */}
      <div style={{ position: "absolute", left: 134, top: 184, width: 690, height: 690, borderRadius: 28, ...GLASS }}>
        <div style={{ position: "absolute", left: 24, top: 20 }}>
          <TitlePill text="Your business" size={20} />
        </div>
        <Field label="Business type" value="Office or studio" t={t} at={16.55} w={640} x={24} y={84} />
        <Field label="What your business does" value="Design studio, five people, client meetings" t={t} at={16.95} dur={0.8} w={640} x={24} y={166} />
        <Field label="City" value="Beograd" t={t} at={17.85} w={310} x={24} y={248} />
        <Field label="Currency" value="EUR" t={t} at={18.05} dur={0.2} w={310} x={354} y={248} />
        <Field label="Monthly budget for the space (EUR)" value="1300" t={t} at={18.35} w={310} x={24} y={330} />
        <Field label="Expected monthly revenue (EUR)" value="12000" t={t} at={18.75} w={310} x={354} y={330} />
        <Field label="Area from (m2)" value="35" t={t} at={19.15} dur={0.2} w={310} x={24} y={412} />
        <Field label="Area to (m2)" value="80" t={t} at={19.35} dur={0.2} w={310} x={354} y={412} />
        <Field label="Lease length (months)" value="36" t={t} at={19.55} dur={0.2} w={310} x={24} y={494} />
        <Field label="Fit-out budget (EUR)" value="5000" t={t} at={19.7} dur={0.25} w={310} x={354} y={494} />
        <Field label="Gross margin (%)" value="80" t={t} at={19.85} dur={0.2} w={310} x={24} y={576} />
        <Field label="Equipment budget (EUR)" value="8000" t={t} at={19.95} dur={0.25} w={310} x={354} y={576} />
      </div>
      {/* Find spaces */}
      <div style={{ position: "absolute", left: 840, top: 184, width: 690, height: 690, borderRadius: 28, ...GLASS }}>
        <div style={{ position: "absolute", left: 24, top: 20 }}>
          <TitlePill text="Find spaces" size={20} />
        </div>
        <div style={{ position: "absolute", left: 26, top: 82, ...text(15, 500, C.ink2) }}>Search for</div>
        <div style={{ position: "absolute", left: 24, top: 108, display: "flex", gap: 10 }}>
          {["Cafe in Novi Sad", "Office in Beograd", "Shop in Novi Sad", "Your business"].map((c) => (
            <div key={c} style={{ height: 42, padding: "0 18px", borderRadius: 99, background: c === "Office in Beograd" ? C.brandSoft : "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", ...text(16, 500) }}>
              {c}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 172,
            height: 50,
            padding: "0 24px",
            borderRadius: 99,
            background: pressed > 0 ? "#26262E" : C.ink,
            scale: String(1 - pressed * 0.06),
            display: "flex",
            alignItems: "center",
            gap: 10,
            ...text(18, 600, "white"),
          }}
        >
          <Play size={18} fill="white" />
          Search and evaluate
        </div>
      </div>
      <Cursor x={cx} y={cy} press={pressed} size={44} opacity={ip(t, [19.7, 19.9], [0, 1])} />
      <ClickRing x={990} y={382} p={ip(t, [click, click + 0.4], [0, 1])} />
    </AbsoluteFill>
  );
};

// ---- Scene 5 and 6: the run (orbit) ---------------------------------------------------------------------------
/** video time -> recorded run time (ms): real speed, slowed down between the deal breaker and the cut */
function runMs(t: number) {
  if (t < 21.75) return 0;
  if (t < 25.6) return ((t - 21.75) / (25.6 - 21.75)) * FLAG_MS;
  if (t < 27.9) return FLAG_MS + ((t - 25.6) / (27.9 - 25.6)) * (CUT_MS - FLAG_MS);
  return CUT_MS + (t - 27.9) * 1400;
}
const OC = { x: 800, y: 398 };
const OR = 318;
const BUSY: { name: string; x: number; y: number; pill: string; px: number; py: number }[] = [
  { name: "Finance analyst", x: 90, y: -175, pill: "calculating total cost", px: -40, py: -104 },
  { name: "Lease reader", x: 200, y: 20, pill: "reading the lease", px: 200, py: 76 },
  { name: "Location analyst", x: -10, y: 185, pill: "checking the area", px: 10, py: 120 },
  { name: "Premises inspector", x: -185, y: 45, pill: "inspecting the space", px: -170, py: -90 },
];
const RIM = [
  { name: "Scout", a: -92 },
  { name: "Report writer", a: -138 },
  { name: "Auditor", a: 180 },
  { name: "Ranker", a: 138 },
];
const agentPos = (name: string, t: number, i: number) => {
  const b = BUSY.find((x) => x.name === name)!;
  return { x: OC.x + b.x + Math.sin(t * 1.3 + i * 1.7) * 10, y: OC.y + b.y + Math.cos(t * 1.1 + i * 2.3) * 8 };
};

const AgentChip: React.FC<{ name: string; x: number; y: number; busy: boolean; red?: boolean; size?: number }> = ({ name, x, y, busy, red, size = 66 }) => {
  const Icon = AGENT_ICONS[name];
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 99,
          background: "white",
          display: "grid",
          placeItems: "center",
          boxShadow: red ? `0 0 0 4px ${C.hard}, 0 0 40px rgba(159,27,18,0.45)` : busy ? `0 0 0 3px ${C.brand}, 0 6px 18px rgba(242,92,84,0.25)` : "0 4px 14px rgba(90,46,80,0.12)",
        }}
      >
        <Icon size={size * 0.38} color={red ? C.hard : C.ink} strokeWidth={2} />
      </div>
      <div style={{ position: "absolute", top: size + 6, left: "50%", translate: "-50% 0", ...text(16, 600), whiteSpace: "nowrap", background: "rgba(255,255,255,0.75)", padding: "2px 10px", borderRadius: 99 }}>{name}</div>
    </div>
  );
};

const RunPage: React.FC<{ t: number }> = ({ t }) => {
  const ms = runMs(t);
  const active = LANES.filter((l) => l.start <= ms && (l.cut ?? l.end) > ms);
  const atWork = Math.min(30, active.length);
  const flagged = ms >= FLAG_MS;
  const cutDone = ms >= CUT_MS;
  const evaluated = ms < 2000 ? 1 : ms < 5000 ? 2 : 4;
  const ruledOut = flagged ? 2 : 1;
  const fieldIn = ip(t, [21.45, 21.9], [0, 1]);
  const pillsIn = (i: number) => ip(t, [22.0 + i * 0.28, 22.3 + i * 0.28], [0, 1]) * (1 - ip(t, [24.7, 24.95], [0, 1]));
  // the red signal from the Lease reader to the Finance analyst
  const lr = agentPos("Lease reader", t, 1);
  const fa = agentPos("Finance analyst", t, 0);
  const sig = ip(t, [26.35, 27.2], [0, 1], easeInOut);
  const sx = lr.x + (fa.x - lr.x) * sig + Math.sin(sig * Math.PI) * 90;
  const sy = lr.y + (fa.y - lr.y) * sig - Math.sin(sig * Math.PI) * 30;
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Research run" />
      <div style={{ position: "absolute", left: 120, top: 78, right: 16, bottom: 16, borderRadius: 32, ...GLASS }} />
      {/* the orbit field: it grows out of the clicked button */}
      <div
        style={{
          position: "absolute",
          left: OC.x - OR,
          top: OC.y - OR,
          width: OR * 2,
          height: OR * 2,
          borderRadius: 999,
          background: "radial-gradient(circle at 50% 45%, #FFFFFF 60%, #FBF4F8 100%)",
          boxShadow: "0 30px 80px rgba(120,60,90,0.16), 0 0 0 5px rgba(242,92,84,0.0)",
          border: "4px solid transparent",
          backgroundClip: "padding-box",
          scale: String(0.2 + fieldIn * 0.8),
          opacity: fieldIn,
        }}
      />
      <svg width={CW} height={CH} style={{ position: "absolute", inset: 0, opacity: fieldIn }}>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.lilac600} />
            <stop offset="0.5" stopColor={C.brand} />
            <stop offset="1" stopColor={C.lilac} />
          </linearGradient>
        </defs>
        <circle cx={OC.x} cy={OC.y} r={OR} fill="none" stroke="url(#ring)" strokeWidth={4} opacity={0.85} />
        {/* lilac links between the busy agents (shared state) */}
        {BUSY.map((a, i) =>
          BUSY.slice(i + 1).map((b, j) => {
            const p = agentPos(a.name, t, i);
            const q = agentPos(b.name, t, i + j + 1);
            return <path key={`${i}-${j}`} d={`M ${p.x} ${p.y} Q ${OC.x} ${OC.y} ${q.x} ${q.y}`} fill="none" stroke={C.lilac} strokeWidth={2} opacity={0.55} />;
          }),
        )}
        {sig > 0 && sig < 1 ? (
          <path d={`M ${lr.x} ${lr.y} Q ${(lr.x + fa.x) / 2 + 90} ${(lr.y + fa.y) / 2 - 30} ${fa.x} ${fa.y}`} fill="none" stroke={C.hard} strokeWidth={4} strokeDasharray="10 8" opacity={0.7} />
        ) : null}
      </svg>
      {RIM.map((r) => {
        const a = (r.a * Math.PI) / 180;
        return <AgentChip key={r.name} name={r.name} x={OC.x + Math.cos(a) * OR} y={OC.y + Math.sin(a) * OR} busy={false} size={58} />;
      })}
      {/* loop dots: one per running loop of that agent, circling it */}
      {BUSY.map((b, i) => {
        const p = agentPos(b.name, t, i);
        const lanes = LANES.filter((l) => l.agent === b.name && l.try === 1);
        return lanes.map((l, k) => {
          const isCutLoop = b.name === "Finance analyst" && l.label === "Voždovac · 51 m2";
          const running = l.start <= ms && (l.cut ?? l.end) > ms;
          const frozenAt = isCutLoop ? Math.min(t, 27.9) : t;
          const ang = frozenAt * 1.6 + (k / lanes.length) * Math.PI * 2;
          const rad = 54;
          const x = p.x + Math.cos(ang) * rad;
          const y = p.y + Math.sin(ang) * rad;
          if (isCutLoop && cutDone && t < 29) {
            return (
              <div key={l.label} style={{ position: "absolute", left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: 99, background: C.hard, display: "grid", placeItems: "center", scale: String(ip(t, [27.9, 28.05], [1.6, 1])) }}>
                <X size={22} color="white" strokeWidth={3} />
              </div>
            );
          }
          if (!running) return null;
          const hot = isCutLoop && t > 26.0;
          return (
            <div
              key={l.label}
              style={{
                position: "absolute",
                left: x - (hot ? 12 : 8),
                top: y - (hot ? 12 : 8),
                width: hot ? 24 : 16,
                height: hot ? 24 : 16,
                borderRadius: 99,
                background: hot ? C.lilac600 : C.brand,
                boxShadow: hot ? "0 0 0 5px rgba(193,155,233,0.45)" : undefined,
              }}
            />
          );
        });
      })}
      {BUSY.map((b, i) => {
        const p = agentPos(b.name, t, i);
        const busy = LANES.some((l) => l.agent === b.name && l.start <= ms && (l.cut ?? l.end) > ms);
        return <AgentChip key={b.name} name={b.name} x={p.x} y={p.y} busy={busy} red={b.name === "Lease reader" && flagged && t < 27.3} />;
      })}
      {/* short "what they do" pills */}
      {BUSY.map((b, i) => {
        const p = agentPos(b.name, t, i);
        const o = pillsIn(i);
        if (o <= 0) return null;
        const Icon = AGENT_ICONS[b.name];
        return (
          <div key={b.name} style={{ position: "absolute", left: p.x + b.px, top: p.y + b.py, translate: "-50% -50%", opacity: o, scale: String(0.6 + o * 0.4) }}>
            <DarkPill icon={Icon} text={b.pill} fontSize={17} />
          </div>
        );
      })}
      {/* centre counter */}
      <div style={{ position: "absolute", left: OC.x - 150, top: OC.y - 70, width: 300, textAlign: "center", opacity: fieldIn * (1 - ip(t, [24.9, 25.1], [0, 0.85])) }}>
        <div style={{ ...text(64, 700), fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{atWork}</div>
        <div style={{ ...text(15, 600, C.ink2), letterSpacing: "0.08em" }}>
          <span style={{ color: C.brand }}>● </span>AT WORK
        </div>
      </div>
      {/* the deal breaker on the Lease reader */}
      {flagged ? (
        <div style={{ position: "absolute", left: lr.x + 44, top: lr.y - 82, opacity: ip(t, [25.6, 25.75], [0, 1]), scale: String(ip(t, [25.6, 25.8], [0.6, 1])), transformOrigin: "0% 100%" }}>
          <DarkPill icon={OctagonAlert} text="Deal breaker: Voždovac · 51 m2" bg={C.hard} fontSize={17} />
          <div style={{ marginTop: 10, width: 330, padding: "14px 18px", borderRadius: 20, ...GLASS_STRONG, background: "rgba(255,255,255,0.95)" }}>
            <div style={text(19, 700, C.hard)}>Unlimited rent increase</div>
            <div style={{ ...text(14, 400, C.ink2), marginTop: 4 }}>
              The landlord may raise the rent at will, with no limit
              <Src k="lease" size={12} />
            </div>
          </div>
        </div>
      ) : null}
      {sig > 0 && sig < 1 ? (
        <div style={{ position: "absolute", left: sx - 13, top: sy - 13, width: 26, height: 26, borderRadius: 99, background: C.hard, boxShadow: "0 0 26px 10px rgba(159,27,18,0.45)" }} />
      ) : null}
      {/* the Finance analyst stops */}
      {cutDone && t < 29 ? (
        <div style={{ position: "absolute", left: fa.x - 250, top: fa.y - 118, opacity: ip(t, [27.95, 28.1], [0, 1]), scale: String(ip(t, [27.9, 28.1], [0.7, 1])) }}>
          <DarkPill icon={CircleStop} text="Finance analyst stopped on Voždovac · 51 m2" bg={C.hard} fontSize={17} />
        </div>
      ) : null}
      {/* stats row */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 28, display: "flex", justifyContent: "center", gap: 14, paddingLeft: 100, opacity: fieldIn }}>
        {[
          [`${evaluated} of 8`, "spaces evaluated", C.ink],
          [`${ruledOut}`, "ruled out by a deal breaker", C.hard],
          [`${atWork} up to 30`, "agent tasks running now", C.ink],
        ].map(([a, b, col]) => (
          <div key={b} style={{ padding: "10px 26px", borderRadius: 22, ...GLASS_STRONG, textAlign: "center" }}>
            <div style={{ ...text(26, 600, col), fontVariantNumeric: "tabular-nums" }}>{a}</div>
            <div style={text(14, 500, C.ink2)}>{b}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 6b: the Timeline --------------------------------------------------------------------------------------
const Tabs: React.FC<{ active: number }> = ({ active }) => (
  <div style={{ position: "absolute", left: 134, top: 78, display: "flex", gap: 10 }}>
    {[
      { icon: List, l: "List" },
      { icon: FileText, l: "Report" },
      { icon: ChartLine, l: "Timeline" },
    ].map((x, i) => {
      const Icon = x.icon;
      return (
        <div key={x.l} style={{ height: 42, padding: "0 18px", borderRadius: 99, display: "flex", alignItems: "center", gap: 8, background: i === active ? C.brandSoft : "rgba(255,255,255,0.8)", ...text(17, 500) }}>
          <Icon size={17} />
          {x.l}
        </div>
      );
    })}
  </div>
);

const TimelinePage: React.FC<{ t: number }> = ({ t }) => {
  const x0 = 470;
  const pxPerS = 100; // 10 s fits 1000 px
  const sweep = ip(t, [28.75, 29.85], [0, 10.2], (v) => v);
  const rows = [
    ...LANES.filter((l) => l.agent === "Finance analyst").map((l) => ({ ...l, group: "Finance analyst" })),
    ...LANES.filter((l) => l.agent === "Lease reader").map((l) => ({ ...l, group: "Lease reader" })),
  ];
  let y = 236;
  const items: React.ReactNode[] = [];
  let lastGroup = "";
  rows.forEach((r, i) => {
    if (r.group !== lastGroup) {
      const Icon = AGENT_ICONS[r.group];
      items.push(
        <div key={`g${i}`} style={{ position: "absolute", left: 168, top: y, display: "flex", alignItems: "center", gap: 8, ...text(15, 500, C.ink2) }}>
          <Icon size={16} />
          {r.group}
        </div>,
      );
      y += 30;
      lastGroup = r.group;
    }
    const stoppedEarly = r.cut !== null;
    const endMs = r.cut ?? r.end;
    const startS = r.start / 1000;
    const endS = endMs / 1000;
    const shownEnd = Math.min(endS, sweep);
    const wBar = Math.max(0, (shownEnd - startS) * pxPerS);
    const isV = r.label === "Voždovac · 51 m2" && r.group === "Finance analyst";
    items.push(
      <div key={`r${i}`} style={{ position: "absolute", left: 168, top: y, ...text(16, 400), whiteSpace: "nowrap" }}>
        {r.label}
        {r.try === 2 ? <span style={{ color: C.ink3 }}> try 2</span> : null}
        {stoppedEarly && sweep >= endS ? <span style={{ color: C.hard }}> stopped</span> : null}
      </div>,
    );
    if (wBar > 0 && endS - startS > 0.05) {
      items.push(
        <div
          key={`b${i}`}
          style={{
            position: "absolute",
            left: x0 + startS * pxPerS,
            top: y + 3,
            width: wBar,
            height: 18,
            borderRadius: 99,
            background: stoppedEarly ? "#E6B1AE" : "#DCC3F3",
            boxShadow: isV && t > 30.2 ? `0 0 0 3px ${C.hard}` : undefined,
          }}
        />,
      );
      r.tools.filter((m) => m / 1000 <= sweep && m <= endMs).forEach((m, k) =>
        items.push(<div key={`d${i}-${k}`} style={{ position: "absolute", left: x0 + (m / 1000) * pxPerS - 6, top: y + 6, width: 12, height: 12, borderRadius: 99, background: C.brand, boxShadow: "0 0 0 2px white" }} />),
      );
    }
    if (stoppedEarly && sweep >= endS) {
      items.push(
        <div key={`x${i}`} style={{ position: "absolute", left: x0 + endS * pxPerS - 12, top: y, width: 24, height: 24, borderRadius: 99, background: C.hard, display: "grid", placeItems: "center" }}>
          <X size={15} color="white" strokeWidth={3} />
        </div>,
      );
    }
    if (isV) {
      items.push(
        <div key="call" style={{ position: "absolute", left: x0 + endS * pxPerS + 24, top: y - 8, opacity: ip(t, [30.3, 30.5], [0, 1]), scale: String(ip(t, [30.3, 30.5], [0.7, 1])), transformOrigin: "0% 50%" }}>
          <DarkPill icon={CircleStop} text="Finance stopped after 4.6 s" bg={C.hard} fontSize={16} />
        </div>,
      );
    }
    y += 28;
  });
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Results" />
      <Tabs active={2} />
      <div style={{ position: "absolute", left: 120, top: 138, right: 16, bottom: 16, borderRadius: 30, ...GLASS }} />
      <div style={{ position: "absolute", left: 150, top: 158, display: "flex", gap: 10, alignItems: "center" }}>
        <TitlePill text="How your research ran" size={20} />
        <div style={{ height: 32, padding: "0 14px", borderRadius: 99, background: C.lilac, display: "flex", alignItems: "center", ...text(14, 500) }}>up to 30 agent tasks at once</div>
        <div style={{ height: 32, padding: "0 14px", borderRadius: 99, background: "white", display: "flex", alignItems: "center", ...text(14, 500) }}>done in 9.9 s</div>
        <div style={{ height: 32, padding: "0 14px", borderRadius: 99, background: C.hard50, display: "flex", alignItems: "center", ...text(14, 500, C.hard) }}>2 spaces ruled out early</div>
      </div>
      {/* axis */}
      {Array.from({ length: 11 }).map((_, i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: x0 + i * pxPerS - 10, top: 210, ...text(13, 500, C.ink2) }}>{i}s</div>
          <div style={{ position: "absolute", left: x0 + i * pxPerS, top: 230, width: 1.5, height: 600, background: "rgba(11,11,15,0.05)" }} />
        </React.Fragment>
      ))}
      {/* deal breaker lines */}
      {[
        { ms: 7, label: "Deal breaker: Banovo brdo · 63 m2 ruled out" },
        { ms: FLAG_MS, label: "Deal breaker: Voždovac · 51 m2 ruled out" },
      ].map((d) =>
        sweep >= d.ms / 1000 ? (
          <React.Fragment key={d.ms}>
            <div style={{ position: "absolute", left: x0 + (d.ms / 1000) * pxPerS, top: 230, width: 0, height: 600, borderLeft: `2px dashed ${C.hard}`, opacity: 0.8 }} />
            <div style={{ position: "absolute", left: x0 + (d.ms / 1000) * pxPerS - (d.ms < 100 ? 0 : 140), top: d.ms < 100 ? 820 : 196, height: 28, padding: "0 12px", borderRadius: 99, background: C.hard, display: "flex", alignItems: "center", gap: 6, ...text(13, 600, "white"), whiteSpace: "nowrap" }}>
              <OctagonAlert size={14} />
              {d.label}
            </div>
          </React.Fragment>
        ) : null,
      )}
      {items}
      {/* playhead */}
      {sweep < 10.1 ? <div style={{ position: "absolute", left: x0 + sweep * pxPerS, top: 226, width: 3, height: 610, background: C.ink, borderRadius: 2 }} /> : null}
    </AbsoluteFill>
  );
};

// ---- Scene 6c: the Report, checked by the Auditor --------------------------------------------------------------
const REPORT_LINES: { pre: string; num: string; post: string; src: string }[] = [
  { pre: "Palilula · 45 m2 is ranked #1 of 6, with a score of ", num: "91-97", post: " out of 100.", src: "calc" },
  { pre: "Palilula · 45 m2: monthly cost ", num: "840 EUR", post: " is 65% of the 1,300 EUR budget.", src: "calc" },
  { pre: "Palilula · 45 m2: lease has ", num: "no rent increase clause", post: ".", src: "lease" },
  { pre: "Karaburma · 62 m2: monthly cost ", num: "670 EUR", post: " is 52% of the 1,300 EUR budget.", src: "calc" },
  { pre: "Novi Beograd · 67 m2 scores ", num: "82-89", post: " out of 100 and costs 1,020 EUR monthly.", src: "calc" },
];
const REPORT_CHECKS = [31.75, 32.25, 32.75, 33.25, 33.75];

const ReportPage: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <Sidebar active={4} />
    <PageTitle title="Results" />
    <Tabs active={1} />
    <div style={{ position: "absolute", left: 120, top: 138, right: 16, bottom: 16, borderRadius: 30, ...GLASS }} />
    <div style={{ position: "absolute", left: 150, top: 160, display: "flex", gap: 12, alignItems: "center" }}>
      <TitlePill text="Every number checked against its source" size={20} />
      <div style={{ opacity: ip(t, [31.35, 31.6], [0, 1]) }}>
        <DarkPill icon={ShieldCheck} text="Auditor: 10 checked, 0 corrected, 0 removed" fontSize={16} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 150, top: 222, ...text(18, 600) }}>Recommendation</div>
    {REPORT_LINES.map((l, i) => {
      const c = REPORT_CHECKS[i];
      const on = ip(t, [c, c + 0.18], [0, 1]);
      const lineIn = ip(t, [31.15 + i * 0.08, 31.4 + i * 0.08], [0, 1]);
      return (
        <div key={i} style={{ position: "absolute", left: 150, top: 268 + i * 72, width: 1240, height: 58, borderRadius: 18, background: `rgba(255,255,255,${0.55 + on * 0.3})`, display: "flex", alignItems: "center", padding: "0 20px", opacity: lineIn, translate: `0px ${(1 - lineIn) * 20}px`, ...text(19, 400) }}>
          <span style={{ flex: 1, whiteSpace: "nowrap" }}>
            {l.pre}
            <span style={{ fontWeight: 700, background: on > 0 ? `rgba(227,247,234,${on})` : undefined, borderRadius: 8, padding: "2px 6px" }}>{l.num}</span>
            <Src k={l.src} size={13} />
            {l.post}
          </span>
          <div style={{ width: 34, height: 34, borderRadius: 99, background: C.green700, display: "grid", placeItems: "center", scale: String(on < 1 ? on * 1.25 : 1), opacity: on }}>
            <Check size={20} color="white" strokeWidth={3} />
          </div>
        </div>
      );
    })}
    {/* the source chain behind one number */}
    <div
      style={{
        position: "absolute",
        left: 640,
        top: 636,
        width: 560,
        padding: "16px 20px",
        borderRadius: 18,
        background: "white",
        boxShadow: "0 16px 40px rgba(11,11,15,0.16)",
        opacity: ip(t, [33.55, 33.75], [0, 1]) * (1 - ip(t, [35.0, 35.15], [0, 1])),
        translate: `0px ${(1 - ip(t, [33.55, 33.8], [0, 1])) * -14}px`,
        ...text(15, 400, C.ink2),
        lineHeight: 1.55,
      }}
    >
      <div style={text(16, 700)}>Where 840 EUR comes from</div>
      <div>
        <b style={{ color: C.ink }}>calc</b> monthly cost = rent 790 EUR + service charge 50 EUR
      </div>
      <div>
        <b style={{ color: C.ink }}>listing</b> listing-bg016: rentMonthly, serviceChargeMonthly
      </div>
      <div>
        <b style={{ color: C.ink }}>profile</b> questionnaire: monthlyBudget 1,300 EUR
      </div>
    </div>
  </AbsoluteFill>
);

// ---- Scene 7: results list and the candidate page ------------------------------------------------------------
const CARDS = [
  { n: 1, name: "Palilula · 45 m2", v: C.green700, cost: "840 EUR", share: "7%", score: 91, conf: "High confidence", reason: "Monthly cost 840 EUR is 65% of the 1,300 EUR budget" },
  { n: 2, name: "Karaburma · 62 m2", v: C.green700, cost: "670 EUR", share: "5.6%", score: 86, conf: "High confidence", reason: "Monthly cost 670 EUR is 52% of the 1,300 EUR budget" },
  { n: 3, name: "Novi Beograd · 67 m2", v: C.green700, cost: "1,020 EUR", share: "8.5%", score: 82, conf: "High confidence", reason: "Monthly cost 1,020 EUR is 78% of the 1,300 EUR budget" },
  { n: 4, name: "Zvezdara · 45 m2", v: C.amber400, cost: "760 EUR", share: "6.3%", score: 87, conf: "Medium confidence", reason: "Monthly cost 760 EUR is 58% of the 1,300 EUR budget" },
  { n: 5, name: "Voždovac · 63 m2", v: C.amber400, cost: "1,040 EUR", share: "8.7%", score: 85, conf: "High confidence", reason: "Monthly cost 1,040 EUR is 80% of the 1,300 EUR budget" },
];

const ListPage: React.FC<{ t: number }> = ({ t }) => {
  const focus = ip(t, [36.75, 37.1], [0, 1]);
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Results" />
      <Tabs active={0} />
      <div style={{ position: "absolute", left: 134, top: 140, ...text(22, 600) }}>Best option: Palilula, 45 m2 - Good, score 91.</div>
      {CARDS.map((c, i) => {
        const a = 35.45 + i * 0.16;
        const p = ip(t, [a, a + 0.5], [0, 1]);
        const recede = i === 0 ? 0 : focus;
        return (
          <div
            key={c.n}
            style={{
              position: "absolute",
              left: 134,
              top: 190 + i * 132,
              width: 1430,
              height: 116,
              borderRadius: 24,
              ...GLASS_STRONG,
              background: "rgba(255,255,255,0.86)",
              boxShadow: i === 0 && focus > 0 ? `0 0 0 ${3 * focus}px ${C.brandSoft}, 0 20px 50px rgba(90,46,80,${0.18 * focus})` : GLASS_STRONG.boxShadow,
              opacity: p * (1 - recede * 0.6),
              translate: `0px ${(1 - p) * 140 - (i === 0 ? focus * 6 : 0)}px`,
              rotate: `x ${(1 - p) * 28}deg`,
              scale: String(i === 0 ? 1 + focus * 0.015 : 1 - recede * 0.02),
              filter: `blur(${recede * 3}px)`,
            }}
          >
            <div style={{ position: "absolute", left: 24, top: 30, width: 54, height: 54, borderRadius: 99, background: c.v, display: "grid", placeItems: "center", ...text(22, 700, "white") }}>{c.n}</div>
            <div style={{ position: "absolute", left: 100, top: 22, ...text(22, 600) }}>{c.name}</div>
            <div style={{ position: "absolute", left: 100, top: 56, ...text(16, 400, C.ink2) }}>{c.name.split(" · ")[0]}, Beograd</div>
            <div style={{ position: "absolute", left: 100, top: 80, ...text(16, 400, C.ink2) }}>
              <b style={{ color: C.ink, fontWeight: 600 }}>Main reason:</b> {c.reason}
            </div>
            <div style={{ position: "absolute", right: 230, top: 30, textAlign: "right" }}>
              <div style={text(20, 700)}>
                {c.cost} <span style={{ fontWeight: 400, fontSize: 16, color: C.ink2 }}>per month</span>
              </div>
              <div style={text(15, 400, C.ink2)}>
                {c.share} of expected revenue
                <Src k="calc" size={12} />
              </div>
            </div>
            <div style={{ position: "absolute", right: 50, top: 22, textAlign: "left" }}>
              <div style={{ ...text(46, 600), letterSpacing: "-0.03em" }}>
                {c.score}
                <span style={{ fontSize: 18, color: C.ink2, fontWeight: 400 }}>/100</span>
              </div>
              <div style={{ ...text(13, 500, C.ink2), textDecoration: "underline" }}>{c.conf}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Row: React.FC<{ l: string; v: string; s?: string; t: number; at: number; big?: boolean }> = ({ l, v, s = "calc", t, at, big }) => {
  const p = ip(t, [at, at + 0.3], [0, 1]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: big ? 58 : 50, borderBottom: "1.5px solid rgba(11,11,15,0.06)", opacity: 0.35 + p * 0.65 }}>
      <span style={text(big ? 19 : 17, 400)}>{l}</span>
      <span style={{ ...text(big ? 21 : 18, 700), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {v}
        <Src k={s} size={12} />
      </span>
    </div>
  );
};

const CandidatePage: React.FC<{ t: number }> = ({ t }) => {
  const open = ip(t, [37.35, 37.85], [0, 1]);
  const bad = ip(t, [39.05, 39.35], [0, 1]);
  const good = ip(t, [39.85, 40.15], [0, 1]);
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Candidate" />
      {/* header: the #1 card opened */}
      <div style={{ position: "absolute", left: 134, top: 80, width: 1430, height: 232, borderRadius: 28, ...GLASS, background: "rgba(255,255,255,0.6)", scale: String(0.96 + open * 0.04), opacity: open }}>
        <div style={{ position: "absolute", left: 26, top: 24, width: 58, height: 58, borderRadius: 99, background: C.green700, display: "grid", placeItems: "center", ...text(24, 700, "white") }}>1</div>
        <div style={{ position: "absolute", left: 104, top: 18, ...text(30, 600), letterSpacing: "-0.02em" }}>Palilula · 45 m2</div>
        <div style={{ position: "absolute", left: 104, top: 58, ...text(17, 400, C.ink2) }}>
          <b style={{ color: C.green700 }}>Good</b> · Palilula, Beograd · 45 m2 · floor 1
        </div>
        {[
          { h: "Score", v: "91-97", u: "/100", sub: "worst case to best case, high confidence. Scored by code." },
          { h: "Monthly cost", v: "840 EUR", u: "", sub: "7% of expected revenue", src: true },
          { h: "Main reason", v: "", u: "", sub: "Monthly cost 840 EUR is 65% of the 1,300 EUR budget.", src: true },
        ].map((b, i) => (
          <div key={b.h} style={{ position: "absolute", left: 26 + i * 466, top: 104, width: 446, height: 108, borderRadius: 22, background: "rgba(255,255,255,0.75)", padding: "14px 20px" }}>
            <div style={text(15, 500, C.ink2)}>{b.h}</div>
            {b.v ? (
              <div style={{ ...text(34, 700), letterSpacing: "-0.02em" }}>
                {b.v}
                <span style={{ fontSize: 17, fontWeight: 400, color: C.ink2 }}>{b.u}</span>
                {b.src ? <Src k="calc" size={13} /> : null}
              </div>
            ) : null}
            <div style={{ ...text(b.v ? 14 : 19, b.v ? 400 : 500, b.v ? C.ink2 : C.ink), marginTop: b.v ? 2 : 6 }}>
              {b.sub}
              {b.src ? <Src k="calc" size={12} /> : null}
            </div>
          </div>
        ))}
      </div>
      {/* three columns */}
      <div style={{ position: "absolute", left: 134, top: 330, width: 466, height: 536, borderRadius: 28, ...GLASS, padding: "20px 24px", opacity: open }}>
        <TitlePill text="Costs" size={20} />
        <div style={{ marginTop: 14 }}>
          <Row l="Monthly cost" v="840 EUR" t={t} at={41.2} />
          <Row l="Initial cost" v="14,580 EUR" t={t} at={41.4} />
          <Row l="Total over the lease (24 months)" v="33,160 EUR" t={t} at={41.6} />
          <Row l="Rent share of revenue" v="7%" t={t} at={41.8} />
          <Row l="Break-even revenue" v="1,050 EUR / month" t={t} at={42.0} />
          <Row l="Payback" v="2 months" t={t} at={42.2} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 616, top: 330, width: 466, height: 536, borderRadius: 28, ...GLASS, padding: "20px 24px", opacity: open }}>
        <TitlePill text="Bad year / good year" size={20} />
        {[
          { h: "Bad year", body: "Leaving after 12 months costs at least", v: "2,500 EUR", p: bad, col: C.hard, bg: C.hard50 },
          { h: "Good year", body: "At your plan, the money you put in comes back in", v: "2 months", p: good, col: C.green700, bg: C.green50 },
        ].map((b, i) => (
          <div key={b.h} style={{ marginTop: 18, borderRadius: 22, background: b.p > 0 ? b.bg : "rgba(255,255,255,0.7)", padding: "18px 20px", scale: String(1 + b.p * 0.03 - ip(t, [i === 0 ? 39.85 : 41.0, i === 0 ? 40.1 : 41.2], [0, 0.03])), boxShadow: b.p > 0 ? `0 0 0 ${2.5 * b.p}px ${b.col}` : undefined }}>
            <div style={text(20, 700, b.col)}>{b.h}</div>
            <div style={{ ...text(18, 400), marginTop: 6, lineHeight: 1.4 }}>{b.body}</div>
            <div style={{ ...text(40, 700), letterSpacing: "-0.02em", marginTop: 4 }}>
              {b.v}
              <Src k="calc" size={13} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 1098, top: 330, width: 466, height: 536, borderRadius: 28, ...GLASS, padding: "20px 24px", opacity: open }}>
        <TitlePill text="Lease or buy" size={20} />
        <div style={{ ...text(15, 600, C.ink2), marginTop: 20, letterSpacing: "0.04em" }}>NET COST OVER 3 YEARS</div>
        {[
          { l: "Leasing, 3 years", v: 28440, s: "28,440 EUR" },
          { l: "Buying, net over 3 years", v: 17429, s: "17,429 EUR" },
        ].map((b, i) => {
          const p = ip(t, [43.0 + i * 0.25, 43.6 + i * 0.25], [0, 1]);
          return (
            <div key={b.l} style={{ marginTop: 16 }}>
              <div style={text(16, 400)}>{b.l}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <div style={{ height: 18, width: (b.v / 28440) * 230 * p, borderRadius: 6, background: C.lilac600 }} />
                <span style={{ ...text(17, 700), whiteSpace: "nowrap" }}>
                  {b.s}
                  <Src k="calc" size={12} />
                </span>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 26 }}>
          <Row l="Cash needed to buy" v="27,308 EUR" t={t} at={43.7} />
          <Row l="Loan payment per month" v="601 EUR" t={t} at={43.85} />
        </div>
        <div style={{ ...text(13, 400, C.ink2), marginTop: 12, lineHeight: 1.45 }}>A rough comparison, not a valuation. Not financial advice.</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------------------------

export const AppWindow: React.FC = () => {
  const f = useCurrentFrame();
  const t = APP_FROM + f / 60;
  const cam = camAt(t);
  const born = ip(t, [APP_FROM, APP_FROM + 0.45], [0, 1]);
  const leave = ip(t, [APP_TO - 0.4, APP_TO], [0, 1], (v) => v * v);
  const url =
    t < 21.5
      ? "suitespot-production.up.railway.app/research/new"
      : t < 28.6
        ? "suitespot-production.up.railway.app/research/run"
        : t < 37.5
          ? "suitespot-production.up.railway.app/research/results"
          : "suitespot-production.up.railway.app/research/candidate";
  // the page change after the click: a white circle from the button covers the page, the run grows in
  const wipe = ip(t, [20.82, 21.3], [0, 1], easeInOut) * (1 - ip(t, [21.3, 21.6], [0, 1]));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", perspective: 2400 }}>
      <div
        style={{
          width: W,
          height: H,
          translate: `${-cam.fx * cam.scale}px ${-cam.fy * cam.scale + leave * 200}px`,
          scale: String(cam.scale * (1 + (1 - born) * 0.12)),
          rotate: undefined,
          transform: `rotateX(${cam.rx}deg) rotateY(${cam.ry}deg)`,
          opacity: 1 - leave,
          filter: leave > 0 ? `blur(${leave * 16}px)` : undefined,
        }}
      >
        <BrowserWindow width={W} height={H} url={url}>
          <div style={{ position: "absolute", inset: 0, opacity: vis(t, 15.0, 21.4, 0.01) }}>
            <NewResearch t={t} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: vis(t, 21.3, 28.75, 0.15) }}>{t > 21.2 && t < 28.8 ? <RunPage t={t} /> : null}</div>
          <div style={{ position: "absolute", inset: 0, opacity: vis(t, 28.6, 31.1, 0.18) }}>{t > 28.5 && t < 31.2 ? <TimelinePage t={t} /> : null}</div>
          <div style={{ position: "absolute", inset: 0, opacity: vis(t, 31.0, 35.4, 0.15) }}>{t > 30.9 && t < 35.5 ? <ReportPage t={t} /> : null}</div>
          <div style={{ position: "absolute", inset: 0, opacity: vis(t, 35.3, 37.6, 0.15) }}>{t > 35.2 && t < 37.7 ? <ListPage t={t} /> : null}</div>
          <div style={{ position: "absolute", inset: 0, opacity: vis(t, 37.4, 45, 0.2) }}>{t > 37.3 ? <CandidatePage t={t} /> : null}</div>
          {wipe > 0 ? <div style={{ position: "absolute", left: 990 - 1900 * wipe, top: 382 - 1900 * wipe, width: 3800 * wipe, height: 3800 * wipe, borderRadius: 9999, background: "white", opacity: 0.96 }} /> : null}
        </BrowserWindow>
      </div>
      {/* the window is born from the white of the lens */}
      <AbsoluteFill style={{ background: "white", opacity: 1 - born }} />
    </AbsoluteFill>
  );
};
void easeOut;
