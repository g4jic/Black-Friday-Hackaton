import React from "react";
import { AbsoluteFill, Img, interpolateColors, staticFile, useCurrentFrame } from "remotion";
import { Home, Search, Building, Bookmark, History, FileText, Play, List, ChartLine, OctagonAlert, Check, X, ShieldCheck, CircleStop, Send } from "lucide-react";
import { C, fontFamily, ip, easeInOut, GLASS, GLASS_STRONG } from "../lib";
import { AGENT_ICONS, BrowserWindow, ClickRing, Cursor, DarkPill, Lens, Src, TitlePill } from "../ui";
import { LANES, FLAG_MS, CUT_MS } from "../run-data";

/**
 * Scenes 4 to 7 in one floating browser window (14.97 s to 42.5 s), so the app stays one object while the camera
 * moves: New research (questionnaire), the run (orbit), the Timeline, the Report, the results list and the candidate
 * page. Every number is from the recorded Office in Beograd run (material/recorded-run).
 *
 * The window opens inside the lens glass that scene 3 leaves in the centre of the frame. Some pages keep their own
 * clock (they were timed on an earlier cut); `t + offset` below maps the video time to that clock.
 */
export const APP_FROM = 14.97;
export const APP_TO = 42.5;
const W = 1600;
const H = 940;
const CW = 1600;
const CH = 882;

// ---- camera keyframes: [time, scale, focusX, focusY (window px from centre), rotX, rotY]
// Content point (x, y) sits at window (x - 800, y + 58 - 470) from the centre.
type K = [number, number, number, number, number, number];
const CAM: K[] = [
  // the window opens in the lens, then one push in onto the Your business card (it fills the frame width)
  [14.97, 0.95, 0, 0, 0, 0],
  [15.35, 1.0, 0, 0, 0, 0],
  [16.0, 2.68, -321, -32, 0, 0],
  // one continuous scroll down the card while the fields fill in
  [19.6, 2.68, -321, 288, 0, 0],
  // glide out to the whole window: every filled field, and the cursor on Search and evaluate
  [20.2, 1.12, 0, 0, 0, 0],
  [20.55, 1.13, 0, 0, 0, 0],
  // the run: the whole window, then the orbit and its right column (all agents and labels in frame)
  [21.05, 1.08, 0, 0, 0, 0],
  [24.1, 1.11, 0, 0, 0, 0],
  [24.7, 1.36, 130, 47, 0, 0],
  [27.95, 1.37, 130, 47, 0, 0],
  // the Timeline: overview, then the Finance and Lease reader rows, names and bars in frame
  [28.4, 1.04, 0, 0, 0, 0],
  [29.5, 1.06, 0, 0, 0, 0],
  [30.05, 1.42, -20, 88, 0, 0],
  [32.05, 1.45, -20, 88, 0, 0],
  [32.5, 1.06, 0, 0, 0, 0],
  [36.45, 1.1, 0, 0, 0, 0],
  [36.8, 1.04, 0, 0, 0, 0],
  [38.4, 1.07, 0, 0, 0, 0],
  [38.75, 1.04, 0, 0, 0, 0],
  [42.1, 1.09, 0, 0, 0, 0],
  [42.5, 1.07, 0, 0, 0, 0],
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

/** visible from a to b (seconds) with short fades */
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

const PageTitle: React.FC<{ title: string; opacity?: number }> = ({ title, opacity = 1 }) => (
  <div style={{ position: "absolute", left: 134, top: 22, ...text(34, 600), letterSpacing: "-0.025em", opacity }}>{title}</div>
);

const Field: React.FC<{ label: string; value: string; t: number; at: number; until: number; dur?: number; w: number; x: number; y: number }> = ({ label, value, t, at, until, dur = 0.45, w, x, y }) => {
  const d = Math.min(dur, until - at - 0.04);
  const n = Math.round(ip(t, [at, at + d], [0, value.length], (v) => v));
  // only one field is active at a time: from just before it starts until the next one starts
  const typing = t >= at - 0.08 && t < until;
  const shown = value.slice(0, n);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      <div style={{ ...text(15, 500, C.ink2), marginBottom: 7 }}>{label}</div>
      <div
        style={{
          height: 48,
          borderRadius: 99,
          background: "rgba(255,255,255,0.86)",
          boxShadow: typing ? `0 0 0 3px ${C.brandSoft}` : "inset 0 0 0 1px rgba(255,255,255,0.9)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          ...text(19, 500),
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

const FIELDS: { label: string; value: string; at: number; dur?: number; w: number; x: number; y: number }[] = [
  { label: "Business type", value: "Office or studio", at: 16.55, dur: 0.3, w: 640, x: 24, y: 84 },
  { label: "What your business does", value: "Design studio, five people, client meetings", at: 16.92, dur: 0.7, w: 640, x: 24, y: 166 },
  { label: "City", value: "Beograd", at: 17.75, dur: 0.25, w: 310, x: 24, y: 248 },
  { label: "Currency", value: "EUR", at: 18.07, dur: 0.15, w: 310, x: 354, y: 248 },
  { label: "Monthly budget for the space (EUR)", value: "1300", at: 18.35, dur: 0.22, w: 310, x: 24, y: 330 },
  { label: "Expected monthly revenue (EUR)", value: "12000", at: 18.65, dur: 0.25, w: 310, x: 354, y: 330 },
  { label: "Area from (m2)", value: "35", at: 19.0, dur: 0.12, w: 310, x: 24, y: 412 },
  { label: "Area to (m2)", value: "80", at: 19.2, dur: 0.12, w: 310, x: 354, y: 412 },
  { label: "Lease length (months)", value: "36", at: 19.4, dur: 0.12, w: 310, x: 24, y: 494 },
  { label: "Fit-out budget (EUR)", value: "5000", at: 19.58, dur: 0.15, w: 310, x: 354, y: 494 },
  { label: "Gross margin (%)", value: "80", at: 19.78, dur: 0.12, w: 310, x: 24, y: 576 },
  { label: "Equipment budget (EUR)", value: "8000", at: 19.96, dur: 0.15, w: 310, x: 354, y: 576 },
];

// ---- Scene 4: New research (own clock: video time + 0.5 s) ----------------------------------------------------
const NewResearch: React.FC<{ t: number }> = ({ t }) => {
  const click = 20.72;
  const pressed = ip(t, [click - 0.06, click], [0, 1]) * (1 - ip(t, [click + 0.08, click + 0.22], [0, 1]));
  const F = FIELDS;
  const cx = ip(t, [20.2, 20.62], [1250, 990], easeInOut);
  const cy = ip(t, [20.2, 20.62], [560, 382], easeInOut);
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
        {F.map((x, i) => (
          <Field key={x.label} {...x} t={t} until={i + 1 < F.length ? F[i + 1].at - 0.08 : x.at + (x.dur ?? 0.45) + 0.3} />
        ))}
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
      <Cursor x={cx} y={cy} press={pressed} size={40} opacity={ip(t, [20.15, 20.3], [0, 1])} />
      <ClickRing x={990} y={382} p={ip(t, [click, click + 0.4], [0, 1])} />
    </AbsoluteFill>
  );
};

// ---- Scene 5 and 6: the run (orbit), own clock: video time + 0.5 s -------------------------------------------------
/** run clock -> recorded run time (ms): real speed, slowed down between the deal breaker and the cut */
function runMs(t: number) {
  if (t < 21.75) return 0;
  if (t < 25.6) return ((t - 21.75) / (25.6 - 21.75)) * FLAG_MS;
  if (t < 27.9) return FLAG_MS + ((t - 25.6) / (27.9 - 25.6)) * (CUT_MS - FLAG_MS);
  return CUT_MS + (t - 27.9) * 1400;
}
const OC = { x: 690, y: 440 };
const OR = 330;
const COL_X = 1090; // the right column: what the agents do, the deal breaker, the stats
const BUSY: { name: string; x: number; y: number; rim: number; pill: string }[] = [
  { name: "Finance analyst", x: 95, y: -180, rim: -52, pill: "calculating total cost" },
  { name: "Lease reader", x: 205, y: 10, rim: 12, pill: "reading the lease" },
  { name: "Location analyst", x: -5, y: 190, rim: 72, pill: "checking the area" },
  { name: "Premises inspector", x: -190, y: 40, rim: 205, pill: "inspecting the space" },
];
const FIELD_IN: [number, number] = [21.05, 21.5];
/** an agent arrives on the circle with the field, with a small stagger */
const appearAt = (i: number) => 21.22 + i * 0.05;
/** a busy agent leaves the circle for the field: one soft move each, slightly staggered */
const moveIn = (t: number, i: number) => ip(t, [21.8 + i * 0.1, 22.6 + i * 0.1], [0, 1], easeInOut);
/** how busy an agent looks (0..1): eases in and out with its loops instead of switching */
const busyLevel = (name: string, ms: number) =>
  LANES.filter((l) => l.agent === name).reduce((m, l) => Math.max(m, ip(ms, [l.start, l.start + 260], [0, 1]) * (1 - ip(ms, [l.cut ?? l.end, (l.cut ?? l.end) + 260], [0, 1]))), 0);
const RIM = [
  { name: "Scout", a: -92 },
  { name: "Report writer", a: -128 },
  { name: "Auditor", a: 180 },
  { name: "Ranker", a: 128 },
];
const agentPos = (name: string, t: number, i: number) => {
  const b = BUSY.find((x) => x.name === name)!;
  const m = moveIn(t, i);
  const a = (b.rim * Math.PI) / 180;
  // along a gentle arc from the circle to its place in the field, then a slow drift
  const rx = Math.cos(a) * OR;
  const ry = Math.sin(a) * OR;
  const bend = Math.sin(m * Math.PI) * 26;
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const drift = m * m;
  return {
    x: OC.x + rx + (b.x - rx) * m + nx * bend + Math.sin(t * 1.3 + i * 1.7) * 8 * drift,
    y: OC.y + ry + (b.y - ry) * m + ny * bend + Math.cos(t * 1.1 + i * 2.3) * 6 * drift,
  };
};

/** an agent: icon in a white disc with a visible outline, name in a pill under it (below the loop dots while busy) */
const AgentChip: React.FC<{ name: string; x: number; y: number; busy: number; red?: number; size?: number; glow?: number; appear?: number }> = ({
  name,
  x,
  y,
  busy,
  red = 0,
  size = 66,
  glow = 0,
  appear = 1,
}) => {
  const Icon = AGENT_ICONS[name];
  if (appear <= 0) return null;
  const ring = interpolateColors(red, [0, 1], [interpolateColors(busy, [0, 1], ["rgba(90,46,80,0.24)", C.brand]), C.hard]);
  const bw = 2 + busy + red * 1.5;
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: appear, scale: String(0.6 + appear * 0.4) }}>
      <div
        style={{
          width: size,
          height: size,
          boxSizing: "border-box",
          borderRadius: 99,
          background: "white",
          border: `${bw}px solid ${ring}`,
          display: "grid",
          placeItems: "center",
          boxShadow: [
            `0 4px 14px rgba(90,46,80,${0.16 - busy * 0.04})`,
            `0 6px 18px rgba(242,92,84,${0.26 * busy})`,
            `0 0 0 ${glow * 12}px rgba(242,92,84,${0.22 * glow})`,
            `0 0 40px rgba(159,27,18,${0.45 * red})`,
          ].join(", "),
        }}
      >
        <Icon size={size * 0.38} color={interpolateColors(red, [0, 1], [C.ink, C.hard])} strokeWidth={2} />
      </div>
      <div
        style={{
          position: "absolute",
          top: size + 8 + busy * 22,
          left: "50%",
          translate: "-50% 0",
          ...text(16, 600),
          whiteSpace: "nowrap",
          background: "white",
          padding: "2px 10px",
          borderRadius: 99,
          border: "1px solid rgba(90,46,80,0.14)",
          boxShadow: "0 2px 8px rgba(90,46,80,0.10)",
        }}
      >
        {name}
      </div>
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
  const fieldIn = ip(t, FIELD_IN, [0, 1], easeInOut);
  const pillsIn = (i: number) => ip(t, [22.0 + i * 0.28, 22.3 + i * 0.28], [0, 1]) * (1 - ip(t, [24.6, 24.85], [0, 1]));
  // the red signal from the Lease reader to the Finance analyst
  const lr = agentPos("Lease reader", t, 1);
  const fa = agentPos("Finance analyst", t, 0);
  const sig = ip(t, [26.35, 27.2], [0, 1], easeInOut);
  const ctrl = { x: (lr.x + fa.x) / 2 + 110, y: (lr.y + fa.y) / 2 - 20 };
  const bz = (p: number, a: number, c: number, b: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * c + p * p * b;
  const sx = bz(sig, lr.x, ctrl.x, fa.x);
  const sy = bz(sig, lr.y, ctrl.y, fa.y);
  const dealIn = ip(t, [25.6, 25.85], [0, 1]);
  const stopIn = ip(t, [27.95, 28.15], [0, 1]);
  // right column positions (content px)
  const DEAL_Y = 300;
  const STOP_Y = 150;
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Research run" opacity={ip(t, [21.2, 21.34], [0, 1])} />
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
          boxShadow: "0 30px 80px rgba(120,60,90,0.16)",
          scale: String(0.2 + fieldIn * 0.8),
          opacity: fieldIn,
        }}
      />
      <svg width={CW} height={CH} style={{ position: "absolute", inset: 0, opacity: fieldIn, overflow: "visible" }}>
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
            return <path key={`${i}-${j}`} d={`M ${p.x} ${p.y} Q ${OC.x} ${OC.y} ${q.x} ${q.y}`} fill="none" stroke={C.lilac} strokeWidth={2} opacity={0.55 * Math.min(moveIn(t, i), moveIn(t, i + j + 1)) ** 2} />;
          }),
        )}
        {sig > 0 && sig < 1 ? (
          <path d={`M ${lr.x} ${lr.y} Q ${ctrl.x} ${ctrl.y} ${fa.x} ${fa.y}`} fill="none" stroke={C.hard} strokeWidth={4} strokeDasharray="10 8" opacity={0.7} />
        ) : null}
        {/* leader lines from the agents to their callouts in the right column */}
        {dealIn > 0 && t < 28.6 ? (
          <path
            d={`M ${lr.x + 40} ${lr.y - 6} C ${lr.x + 140} ${lr.y - 10}, ${COL_X - 90} ${DEAL_Y + 18}, ${COL_X - 6} ${DEAL_Y + 18}`}
            fill="none"
            stroke={C.hard}
            strokeWidth={3}
            strokeDasharray={420}
            strokeDashoffset={420 * (1 - dealIn)}
            strokeLinecap="round"
          />
        ) : null}
        {stopIn > 0 ? (
          <path
            d={`M ${fa.x + 40} ${fa.y - 14} C ${fa.x + 140} ${fa.y - 60}, ${COL_X - 90} ${STOP_Y + 18}, ${COL_X - 6} ${STOP_Y + 18}`}
            fill="none"
            stroke={C.hard}
            strokeWidth={3}
            strokeDasharray={420}
            strokeDashoffset={420 * (1 - stopIn)}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      {RIM.map((r, i) => {
        const a = (r.a * Math.PI) / 180;
        return <AgentChip key={r.name} name={r.name} x={OC.x + Math.cos(a) * OR} y={OC.y + Math.sin(a) * OR} busy={0} size={58} appear={ip(t, [appearAt(4 + i), appearAt(4 + i) + 0.32], [0, 1], easeInOut)} />;
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
          const rad = 48;
          const x = p.x + Math.cos(ang) * rad;
          const y = p.y + Math.sin(ang) * rad;
          if (isCutLoop && cutDone && t < 29) {
            return (
              <div key={l.label} style={{ position: "absolute", left: x - 15, top: y - 15, width: 30, height: 30, borderRadius: 99, background: C.hard, display: "grid", placeItems: "center", scale: String(ip(t, [27.9, 28.05], [1.6, 1])) }}>
                <X size={19} color="white" strokeWidth={3} />
              </div>
            );
          }
          const life = ip(ms, [l.start, l.start + 260], [0, 1]) * (1 - ip(ms, [l.cut ?? l.end, (l.cut ?? l.end) + 260], [0, 1]));
          if (!running && life <= 0) return null;
          const hot = ip(t, [25.9, 26.15], [0, 1]) * (isCutLoop ? 1 : 0);
          const d = 16 + hot * 6;
          return (
            <div
              key={l.label}
              style={{
                position: "absolute",
                left: x - d / 2,
                top: y - d / 2,
                width: d,
                height: d,
                boxSizing: "border-box",
                borderRadius: 99,
                border: "2px solid white",
                background: interpolateColors(hot, [0, 1], [C.brand, C.lilac600]),
                boxShadow: `0 1px 4px rgba(11,11,15,0.2), 0 0 0 ${hot * 4}px rgba(193,155,233,0.45)`,
                opacity: life,
                scale: String(0.4 + life * 0.6),
              }}
            />
          );
        });
      })}
      {BUSY.map((b, i) => {
        const p = agentPos(b.name, t, i);
        const red = b.name === "Lease reader" ? ip(t, [25.6, 25.8], [0, 1]) * (1 - ip(t, [27.2, 27.45], [0, 1])) : 0;
        const glow = Math.sin(Math.PI * ip(t, [22.0 + i * 0.28, 23.0 + i * 0.28], [0, 1]));
        return <AgentChip key={b.name} name={b.name} x={p.x} y={p.y} busy={busyLevel(b.name, ms)} glow={glow} red={red} appear={ip(t, [appearAt(i), appearAt(i) + 0.32], [0, 1], easeInOut)} />;
      })}
      {/* centre counter, above the links on its own white disc */}
      <div
        style={{
          position: "absolute",
          left: OC.x - 78,
          top: OC.y - 78,
          width: 156,
          height: 156,
          borderRadius: 999,
          background: "white",
          boxShadow: "0 10px 30px rgba(90,46,80,0.14)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: fieldIn,
          scale: String(0.6 + fieldIn * 0.4),
        }}
      >
        <div style={{ ...text(56, 700), fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>{atWork}</div>
        <div style={{ ...text(14, 700, C.ink2), letterSpacing: "0.08em", marginTop: 6 }}>
          <span style={{ color: C.brand }}>● </span>AT WORK
        </div>
      </div>
      {/* what the busy agents do: callouts in the right column, never over the orbit */}
      {BUSY.map((b, i) => {
        const o = pillsIn(i);
        if (o <= 0) return null;
        const Icon = AGENT_ICONS[b.name];
        return (
          <div key={b.name} style={{ position: "absolute", left: COL_X, top: 150 + i * 62, opacity: o, translate: `${(1 - o) * 24}px 0px` }}>
            <DarkPill icon={Icon} text={`${b.name}: ${b.pill}`} fontSize={17} />
          </div>
        );
      })}
      {/* the deal breaker, beside the Lease reader */}
      {dealIn > 0 && t < 28.6 ? (
        <div style={{ position: "absolute", left: COL_X, top: DEAL_Y, opacity: dealIn, scale: String(0.7 + dealIn * 0.3), transformOrigin: "0% 50%" }}>
          <DarkPill icon={OctagonAlert} text="Deal breaker: Voždovac · 51 m2" bg={C.hard} fontSize={17} />
          <div style={{ marginTop: 10, width: 400, padding: "14px 20px", borderRadius: 20, background: "rgba(255,255,255,0.96)", boxShadow: "0 10px 30px rgba(90,46,80,0.12)" }}>
            <div style={text(21, 700, C.hard)}>Unlimited rent increase</div>
            <div style={{ ...text(16, 400, C.ink2), marginTop: 4 }}>
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
      {stopIn > 0 ? (
        <div style={{ position: "absolute", left: COL_X, top: STOP_Y, opacity: stopIn, scale: String(0.7 + stopIn * 0.3), transformOrigin: "0% 50%" }}>
          <DarkPill icon={CircleStop} text="Finance analyst stopped on Voždovac · 51 m2" bg={C.hard} fontSize={17} />
        </div>
      ) : null}
      {/* stats, right column */}
      <div style={{ position: "absolute", left: COL_X, top: 470, width: 440, display: "flex", flexDirection: "column", gap: 12, opacity: fieldIn }}>
        {[
          [`${evaluated} of 8`, "spaces evaluated", C.ink],
          [`${ruledOut}`, "ruled out by a deal breaker", C.hard],
          [`${atWork}`, "agent tasks running now (up to 30)", C.ink],
        ].map(([a, b, col]) => (
          <div key={b} style={{ height: 66, padding: "0 22px", borderRadius: 22, ...GLASS_STRONG, background: "rgba(255,255,255,0.86)", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ ...text(30, 700, col), fontVariantNumeric: "tabular-nums", minWidth: 86 }}>{a}</div>
            <div style={text(16, 500, C.ink2)}>{b}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 6b: the Timeline (video time) ----------------------------------------------------------------------------
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

const TL = { x0: 520, pxPerS: 88, top: 250, rowH: 34 };
const TL_SWEEP: [number, number] = [28.3, 29.5];
const TL_MARK = 29.95; // the Lease reader's deal breaker lights up
const TL_LINK: [number, number] = [30.15, 30.5]; // the line to the Finance analyst's bar
const TL_STOP = 30.5; // the Finance bar gets its stop mark
const VOZ = "Voždovac · 51 m2";

const TimelinePage: React.FC<{ t: number }> = ({ t }) => {
  const { x0, pxPerS, rowH } = TL;
  const sweep = ip(t, TL_SWEEP, [0, 10.2], (v) => v);
  const fin = LANES.filter((l) => l.agent === "Finance analyst");
  const lea = LANES.filter((l) => l.agent === "Lease reader");
  // the two Voždovac rows meet across the group header: Finance last, Lease reader first
  const rows = [
    ...fin.filter((l) => l.label !== VOZ).map((l) => ({ ...l, group: "Finance analyst" })),
    ...fin.filter((l) => l.label === VOZ).map((l) => ({ ...l, group: "Finance analyst" })),
    ...lea.filter((l) => l.label === VOZ).map((l) => ({ ...l, group: "Lease reader" })),
    ...lea.filter((l) => l.label !== VOZ).map((l) => ({ ...l, group: "Lease reader" })),
  ];
  let y = TL.top;
  const items: React.ReactNode[] = [];
  let lastGroup = "";
  let finY = 0;
  let leaY = 0;
  const focus = ip(t, [29.6, 29.95], [0, 1]);
  rows.forEach((r, i) => {
    if (r.group !== lastGroup) {
      const Icon = AGENT_ICONS[r.group];
      items.push(
        <div key={`g${i}`} style={{ position: "absolute", left: 168, top: y + 4, display: "flex", alignItems: "center", gap: 8, ...text(17, 700, C.ink2) }}>
          <Icon size={18} />
          {r.group}
        </div>,
      );
      y += rowH;
      lastGroup = r.group;
    }
    const isFinV = r.label === VOZ && r.group === "Finance analyst";
    const isLeaV = r.label === VOZ && r.group === "Lease reader";
    if (isFinV) finY = y;
    if (isLeaV) leaY = y;
    const stoppedEarly = r.cut !== null;
    const endMs = r.cut ?? r.end;
    const startS = r.start / 1000;
    const endS = endMs / 1000;
    const shownEnd = Math.min(endS, sweep);
    const wBar = Math.max(0, (shownEnd - startS) * pxPerS);
    const hl = (isFinV || isLeaV) && focus > 0;
    if (hl) {
      items.push(<div key={`h${i}`} style={{ position: "absolute", left: 150, top: y - 4, width: 1200, height: rowH - 2, borderRadius: 12, background: `rgba(255,255,255,${0.85 * focus})`, boxShadow: `0 6px 20px rgba(159,27,18,${0.1 * focus})` }} />);
    }
    const showStop = stoppedEarly && (isFinV ? t >= TL_STOP : sweep >= endS);
    items.push(
      <div key={`r${i}`} style={{ position: "absolute", left: 168, top: y, ...text(18, hl ? 600 : 400), whiteSpace: "nowrap" }}>
        {r.label}
        {r.try === 2 ? <span style={{ color: C.ink3 }}> try 2</span> : null}
        {showStop ? <span style={{ color: C.hard, fontWeight: 600 }}> stopped</span> : null}
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
            height: 20,
            borderRadius: 99,
            background: stoppedEarly ? "#E6B1AE" : "#DCC3F3",
            boxShadow: isFinV && t >= TL_STOP ? `0 0 0 3px ${C.hard}` : undefined,
          }}
        />,
      );
      r.tools.filter((m) => m / 1000 <= sweep && m <= endMs).forEach((m, k) =>
        items.push(<div key={`d${i}-${k}`} style={{ position: "absolute", left: x0 + (m / 1000) * pxPerS - 6, top: y + 7, width: 12, height: 12, borderRadius: 99, background: C.brand, boxShadow: "0 0 0 2px white" }} />),
      );
    }
    if (showStop) {
      const pop = isFinV ? ip(t, [TL_STOP, TL_STOP + 0.15], [1.7, 1]) : 1;
      items.push(
        <div key={`x${i}`} style={{ position: "absolute", left: x0 + endS * pxPerS - 13, top: y, width: 26, height: 26, borderRadius: 99, background: C.hard, display: "grid", placeItems: "center", scale: String(pop) }}>
          <X size={16} color="white" strokeWidth={3} />
        </div>,
      );
    }
    y += rowH;
  });
  const chartBottom = y + 6;
  // the deal breaker on the Lease reader's bar, the link up to the Finance bar
  const mark = ip(t, [TL_MARK, TL_MARK + 0.2], [0, 1]);
  const link = ip(t, TL_LINK, [0, 1], easeInOut);
  const callout = ip(t, [TL_STOP + 0.1, TL_STOP + 0.3], [0, 1]);
  const mx = x0 + (FLAG_MS / 1000) * pxPerS;
  const my = leaY + 13;
  const cx = x0 + (CUT_MS / 1000) * pxPerS;
  const cy = finY + 13;
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Results" />
      <Tabs active={2} />
      <div style={{ position: "absolute", left: 120, top: 138, right: 16, bottom: 16, borderRadius: 30, ...GLASS }} />
      <div style={{ position: "absolute", left: 150, top: 156, display: "flex", gap: 10, alignItems: "center" }}>
        <TitlePill text="How your research ran" size={20} />
        <div style={{ height: 34, padding: "0 14px", borderRadius: 99, background: C.lilac, display: "flex", alignItems: "center", ...text(15, 600) }}>up to 30 agent tasks at once</div>
        <div style={{ height: 34, padding: "0 14px", borderRadius: 99, background: "white", display: "flex", alignItems: "center", ...text(15, 600) }}>done in 9.9 s</div>
        <div style={{ height: 34, padding: "0 14px", borderRadius: 99, background: C.hard50, display: "flex", alignItems: "center", ...text(15, 600, C.hard) }}>2 spaces ruled out early</div>
      </div>
      {/* axis */}
      {Array.from({ length: 11 }).map((_, i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: x0 + i * pxPerS - 10, top: 214, ...text(15, 500, C.ink2) }}>{i}s</div>
          <div style={{ position: "absolute", left: x0 + i * pxPerS, top: 238, width: 1.5, height: chartBottom - 238, background: "rgba(11,11,15,0.06)" }} />
        </React.Fragment>
      ))}
      {/* the early deal breaker (Banovo brdo) as a dashed line */}
      {sweep > 0 ? <div style={{ position: "absolute", left: x0 + 0.007 * pxPerS, top: 238, width: 0, height: chartBottom - 238, borderLeft: `2px dashed ${C.hard}`, opacity: 0.45 }} /> : null}
      {items}
      {/* deal breaker mark at 4.0 s on the Lease reader's bar */}
      {mark > 0 ? (
        <>
          <div style={{ position: "absolute", left: mx, top: 238, width: 0, height: chartBottom - 238, borderLeft: `2px dashed ${C.hard}`, opacity: 0.55 * mark }} />
          <div style={{ position: "absolute", left: mx - 14, top: my - 14, width: 28, height: 28, borderRadius: 99, background: C.hard, display: "grid", placeItems: "center", scale: String(ip(t, [TL_MARK, TL_MARK + 0.2], [1.8, 1])), boxShadow: `0 0 0 ${8 * (1 - mark) + 4}px rgba(159,27,18,0.18)` }}>
            <OctagonAlert size={16} color="white" strokeWidth={2.6} />
          </div>
          <div style={{ position: "absolute", left: mx + 26, top: my - 17, opacity: mark, translate: `${(1 - mark) * -12}px 0px` }}>
            <DarkPill icon={OctagonAlert} text="Lease reader: deal breaker at 4.0 s" bg={C.hard} fontSize={16} />
          </div>
        </>
      ) : null}
      {/* the link: from the Lease reader's mark up to the end of the Finance bar */}
      {link > 0 ? (
        <svg width={CW} height={CH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path
            d={`M ${mx} ${my - 14} C ${mx} ${(my + cy) / 2}, ${cx} ${(my + cy) / 2}, ${cx} ${cy + 14}`}
            fill="none"
            stroke={C.hard}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={200}
            strokeDashoffset={200 * (1 - link)}
          />
        </svg>
      ) : null}
      {callout > 0 ? (
        <div style={{ position: "absolute", left: cx + 26, top: cy - 17, opacity: callout, scale: String(0.7 + callout * 0.3), transformOrigin: "0% 50%" }}>
          <DarkPill icon={CircleStop} text="Finance stopped after 4.6 s" bg={C.hard} fontSize={16} />
        </div>
      ) : null}
      {/* playhead */}
      {sweep > 0 && sweep < 10.1 ? <div style={{ position: "absolute", left: x0 + sweep * pxPerS, top: 234, width: 3, height: chartBottom - 230, background: C.ink, borderRadius: 2 }} /> : null}
    </AbsoluteFill>
  );
};

// ---- Scene 6c: the Report, checked by the Auditor (own clock: video time - 1.3 s) ----------------------------------
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
    <div style={{ position: "absolute", left: 150, top: 158, display: "flex", gap: 12, alignItems: "center" }}>
      <TitlePill text="Every number checked against its source" size={21} />
      <div style={{ opacity: ip(t, [31.35, 31.6], [0, 1]) }}>
        <DarkPill icon={ShieldCheck} text="Auditor: 10 checked, 0 corrected, 0 removed" fontSize={17} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 150, top: 226, ...text(20, 700) }}>Recommendation</div>
    {REPORT_LINES.map((l, i) => {
      const c = REPORT_CHECKS[i];
      const on = ip(t, [c, c + 0.18], [0, 1]);
      const lineIn = ip(t, [31.15 + i * 0.08, 31.4 + i * 0.08], [0, 1]);
      return (
        <div key={i} style={{ position: "absolute", left: 150, top: 270 + i * 76, width: 1300, height: 62, borderRadius: 20, background: `rgba(255,255,255,${0.6 + on * 0.3})`, display: "flex", alignItems: "center", padding: "0 22px", opacity: lineIn, translate: `0px ${(1 - lineIn) * 20}px`, ...text(21, 400) }}>
          <span style={{ flex: 1, whiteSpace: "nowrap" }}>
            {l.pre}
            <span style={{ fontWeight: 700, background: on > 0 ? `rgba(227,247,234,${on})` : undefined, borderRadius: 8, padding: "2px 6px" }}>{l.num}</span>
            <Src k={l.src} size={14} />
            {l.post}
          </span>
          <div style={{ width: 36, height: 36, borderRadius: 99, background: C.green700, display: "grid", placeItems: "center", scale: String(on < 1 ? on * 1.25 : 1), opacity: on }}>
            <Check size={21} color="white" strokeWidth={3} />
          </div>
        </div>
      );
    })}
    {/* the source chain behind one number, under the lines */}
    <div
      style={{
        position: "absolute",
        left: 560,
        top: 664,
        width: 640,
        padding: "16px 22px",
        borderRadius: 20,
        background: "white",
        boxShadow: "0 16px 40px rgba(11,11,15,0.16)",
        opacity: ip(t, [33.55, 33.75], [0, 1]),
        translate: `0px ${(1 - ip(t, [33.55, 33.8], [0, 1])) * -14}px`,
        ...text(17, 400, C.ink2),
        lineHeight: 1.55,
      }}
    >
      <div style={text(18, 700)}>Where 840 EUR comes from</div>
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

// ---- Scene 7: results list (video time) ------------------------------------------------------------------------
const CARDS = [
  { n: 1, name: "Palilula · 45 m2", v: C.green700, cost: "840 EUR", share: "7%", score: 91, conf: "High confidence", reason: "Monthly cost 840 EUR is 65% of the 1,300 EUR budget" },
  { n: 2, name: "Karaburma · 62 m2", v: C.green700, cost: "670 EUR", share: "5.6%", score: 86, conf: "High confidence", reason: "Monthly cost 670 EUR is 52% of the 1,300 EUR budget" },
  { n: 3, name: "Novi Beograd · 67 m2", v: C.green700, cost: "1,020 EUR", share: "8.5%", score: 82, conf: "High confidence", reason: "Monthly cost 1,020 EUR is 78% of the 1,300 EUR budget" },
  { n: 4, name: "Zvezdara · 45 m2", v: C.amber400, cost: "760 EUR", share: "6.3%", score: 87, conf: "Medium confidence", reason: "Monthly cost 760 EUR is 58% of the 1,300 EUR budget" },
  { n: 5, name: "Voždovac · 63 m2", v: C.amber400, cost: "1,040 EUR", share: "8.7%", score: 85, conf: "High confidence", reason: "Monthly cost 1,040 EUR is 80% of the 1,300 EUR budget" },
];
const LIST_IN = 36.6; // first card
const LIST_STEP = 0.22; // the cards land in rank order
const LIST_FOCUS = 37.95;
const MORPH: [number, number] = [38.4, 38.78]; // card #1 becomes the candidate header
const HEAD = { top: 80, h: 200 };

const ListPage: React.FC<{ t: number }> = ({ t }) => {
  const focus = ip(t, [LIST_FOCUS, LIST_FOCUS + 0.3], [0, 1]);
  const morph = ip(t, MORPH, [0, 1], easeInOut);
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Results" opacity={1 - ip(t, [MORPH[0], MORPH[0] + 0.16], [0, 1])} />
      <div style={{ opacity: 1 - morph }}>
        <Tabs active={0} />
      </div>
      <div style={{ position: "absolute", left: 134, top: 138, ...text(24, 600), opacity: ip(t, [36.65, 36.85], [0, 1]) * (1 - morph) }}>Best option: Palilula, 45 m2 - Good, score 91.</div>
      {CARDS.map((c, i) => {
        const a = LIST_IN + i * LIST_STEP;
        const p = ip(t, [a, a + 0.45], [0, 1]);
        const recede = i === 0 ? 0 : focus;
        const top = i === 0 ? 186 + (HEAD.top - 186) * morph : 186 + i * 132 + morph * 80;
        const h = i === 0 ? 116 + (HEAD.h - 116) * morph : 116;
        return (
          <div
            key={c.n}
            style={{
              position: "absolute",
              left: 134,
              top,
              width: 1430,
              height: h,
              borderRadius: 24 + morph * 4,
              ...GLASS_STRONG,
              background: "rgba(255,255,255,0.86)",
              boxShadow: i === 0 && focus > 0 ? `0 0 0 ${3 * focus * (1 - morph)}px ${C.brandSoft}, 0 20px 50px rgba(90,46,80,${0.18 * focus})` : GLASS_STRONG.boxShadow,
              opacity: p * (1 - recede * 0.35) * (i === 0 ? 1 : 1 - morph),
              translate: `0px ${(1 - p) * 160}px`,
              scale: String((0.94 + p * 0.06) * (i === 0 ? 1 + focus * 0.012 * (1 - morph) : 1)),
            }}
          >
            <div style={{ opacity: 1 - morph }}>
              <div style={{ position: "absolute", left: 24, top: 30, width: 54, height: 54, borderRadius: 99, background: c.v, display: "grid", placeItems: "center", ...text(22, 700, "white"), scale: String(ip(t, [a + 0.15, a + 0.4], [0.3, 1])) }}>{c.n}</div>
              <div style={{ position: "absolute", left: 100, top: 20, ...text(23, 600) }}>{c.name}</div>
              <div style={{ position: "absolute", left: 100, top: 54, ...text(17, 400, C.ink2) }}>{c.name.split(" · ")[0]}, Beograd</div>
              <div style={{ position: "absolute", left: 100, top: 79, ...text(17, 400, C.ink2) }}>
                <b style={{ color: C.ink, fontWeight: 600 }}>Main reason:</b> {c.reason}
              </div>
              <div style={{ position: "absolute", right: 230, top: 28, textAlign: "right" }}>
                <div style={text(22, 700)}>
                  {c.cost} <span style={{ fontWeight: 400, fontSize: 17, color: C.ink2 }}>per month</span>
                </div>
                <div style={text(16, 400, C.ink2)}>
                  {c.share} of expected revenue
                  <Src k="calc" size={12} />
                </div>
              </div>
              <div style={{ position: "absolute", right: 50, top: 20, textAlign: "left" }}>
                <div style={{ ...text(48, 600), letterSpacing: "-0.03em" }}>
                  {c.score}
                  <span style={{ fontSize: 19, color: C.ink2, fontWeight: 400 }}>/100</span>
                </div>
                <div style={{ ...text(14, 500, C.ink2), textDecoration: "underline" }}>{c.conf}</div>
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- Scene 7b: the candidate page (video time) -------------------------------------------------------------------
const Row: React.FC<{ l: string; v: string; s?: string; t: number; at: number }> = ({ l, v, s = "calc", t, at }) => {
  const p = ip(t, [at, at + 0.25], [0, 1]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, borderBottom: "1.5px solid rgba(11,11,15,0.06)", opacity: p, translate: `0px ${(1 - p) * 10}px` }}>
      <span style={text(19, 400)}>{l}</span>
      <span style={{ ...text(20, 700), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {v}
        <Src k={s} size={12} />
      </span>
    </div>
  );
};

const C_OPEN = 38.7;
const C_BAD = 41.0;
const C_GOOD = 41.6;
export const OFFER_CLICK = 42.0;
/** the Make an offer button in the header, content px (its centre) */
export const OFFER_BTN = { x: 1446, y: 125 };

const CandidatePage: React.FC<{ t: number }> = ({ t }) => {
  const open = ip(t, [C_OPEN, C_OPEN + 0.15], [0, 1]);
  const bad = ip(t, [C_BAD, C_BAD + 0.25], [0, 1]);
  const good = ip(t, [C_GOOD, C_GOOD + 0.25], [0, 1]);
  const col = (i: number) => ip(t, [C_OPEN + 0.1 + i * 0.08, C_OPEN + 0.5 + i * 0.08], [0, 1]);
  const press = ip(t, [OFFER_CLICK - 0.05, OFFER_CLICK], [0, 1]) * (1 - ip(t, [OFFER_CLICK + 0.06, OFFER_CLICK + 0.2], [0, 1]));
  const curX = ip(t, [41.55, 41.95], [1250, OFFER_BTN.x + 30], easeInOut);
  const curY = ip(t, [41.55, 41.95], [520, OFFER_BTN.y + 6], easeInOut);
  const colStyle = (i: number, left: number): React.CSSProperties => ({
    position: "absolute",
    left,
    top: 296,
    width: 466,
    height: 570,
    borderRadius: 28,
    ...GLASS,
    background: "rgba(255,255,255,0.6)",
    padding: "20px 24px",
    opacity: col(i),
    translate: `0px ${(1 - col(i)) * 60}px`,
  });
  return (
    <AbsoluteFill>
      <Sidebar active={4} />
      <PageTitle title="Candidate" opacity={ip(t, [38.72, 38.88], [0, 1])} />
      {/* header: the #1 card, opened */}
      <div style={{ position: "absolute", left: 134, top: HEAD.top, width: 1430, height: HEAD.h, borderRadius: 28, ...GLASS_STRONG, background: "rgba(255,255,255,0.86)", opacity: open }}>
        <div style={{ position: "absolute", left: 26, top: 22, width: 54, height: 54, borderRadius: 99, background: C.green700, display: "grid", placeItems: "center", ...text(23, 700, "white") }}>1</div>
        <div style={{ position: "absolute", left: 98, top: 16, ...text(30, 600), letterSpacing: "-0.02em" }}>Palilula · 45 m2</div>
        <div style={{ position: "absolute", left: 98, top: 56, ...text(17, 400, C.ink2) }}>
          <b style={{ color: C.green700 }}>Good</b> · Palilula, Beograd · 45 m2 · floor 1
        </div>
        <div style={{ position: "absolute", left: OFFER_BTN.x - 134 - 100, top: 22, width: 200, height: 48, borderRadius: 99, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, ...text(18, 600, "white"), scale: String(1 - press * 0.07) }}>
          <Send size={18} />
          Make an offer
        </div>
        {[
          { h: "Score", v: "91-97", u: "/100", sub: "scored by code", w: 380, src: false },
          { h: "Monthly cost", v: "840 EUR", u: "", sub: "7% of expected revenue", w: 380, src: true },
          { h: "Main reason", v: "", u: "", sub: "Monthly cost 840 EUR is 65% of the 1,300 EUR budget.", w: 610, src: true },
        ].map((b, i, arr) => {
          const left = 26 + arr.slice(0, i).reduce((s2, x) => s2 + x.w + 16, 0);
          return (
            <div key={b.h} style={{ position: "absolute", left, top: 94, width: b.w, height: 86, borderRadius: 22, background: "rgba(255,255,255,0.8)", padding: "12px 20px" }}>
              <div style={text(15, 500, C.ink2)}>{b.h}</div>
              {b.v ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap" }}>
                  <span style={{ ...text(32, 700), letterSpacing: "-0.02em" }}>
                    {b.v}
                    <span style={{ fontSize: 17, fontWeight: 400, color: C.ink2 }}>{b.u}</span>
                  </span>
                  <span style={text(15, 400, C.ink2)}>{b.sub}</span>
                  {b.src ? <Src k="calc" size={12} /> : null}
                </div>
              ) : (
                <div style={{ ...text(20, 600), marginTop: 8, whiteSpace: "nowrap" }}>
                  {b.sub}
                  <Src k="calc" size={12} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* three columns */}
      <div style={colStyle(0, 134)}>
        <TitlePill text="Costs" size={20} />
        <div style={{ marginTop: 14 }}>
          <Row l="Monthly cost" v="840 EUR" t={t} at={39.1} />
          <Row l="Initial cost" v="14,580 EUR" t={t} at={39.25} />
          <Row l="Total over the lease (24 months)" v="33,160 EUR" t={t} at={39.4} />
          <Row l="Rent share of revenue" v="7%" t={t} at={39.55} />
          <Row l="Break-even revenue" v="1,050 EUR / month" t={t} at={39.7} />
          <Row l="Payback" v="2 months" t={t} at={39.85} />
        </div>
      </div>
      <div style={colStyle(1, 616)}>
        <TitlePill text="Bad year / good year" size={20} />
        {[
          { h: "Bad year", body: "Leaving after 12 months costs at least", v: "2,500 EUR", p: bad, col: C.hard, bg: C.hard50 },
          { h: "Good year", body: "The money you put in comes back in", v: "2 months", p: good, col: C.green700, bg: C.green50 },
        ].map((b) => (
          <div
            key={b.h}
            style={{
              marginTop: 18,
              borderRadius: 22,
              background: b.p > 0 ? b.bg : "rgba(255,255,255,0.75)",
              padding: "18px 22px",
              scale: String(1 + Math.sin(b.p * Math.PI) * 0.04),
              boxShadow: b.p > 0 ? `0 0 0 ${3 * b.p}px ${b.col}` : undefined,
            }}
          >
            <div style={text(21, 700, b.col)}>{b.h}</div>
            <div style={{ ...text(19, 400), marginTop: 6, whiteSpace: "nowrap" }}>{b.body}</div>
            <div style={{ ...text(44, 700), letterSpacing: "-0.02em", marginTop: 4 }}>
              {b.v}
              <Src k="calc" size={13} />
            </div>
          </div>
        ))}
      </div>
      <div style={colStyle(2, 1098)}>
        <TitlePill text="Lease or buy" size={20} />
        <div style={{ ...text(15, 700, C.ink2), marginTop: 20, letterSpacing: "0.04em" }}>NET COST OVER 3 YEARS</div>
        {[
          { l: "Leasing, 3 years", v: 28440, s: "28,440 EUR" },
          { l: "Buying, net over 3 years", v: 17429, s: "17,429 EUR" },
        ].map((b, i) => {
          const p = ip(t, [39.6 + i * 0.2, 40.1 + i * 0.2], [0, 1]);
          return (
            <div key={b.l} style={{ marginTop: 14 }}>
              <div style={text(18, 400)}>{b.l}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <div style={{ height: 20, width: (b.v / 28440) * 210 * p, borderRadius: 6, background: C.lilac600 }} />
                <span style={{ ...text(20, 700), whiteSpace: "nowrap" }}>
                  {b.s}
                  <Src k="calc" size={12} />
                </span>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 18 }}>
          <Row l="Cash needed to buy" v="27,308 EUR" t={t} at={40.1} />
          <Row l="Loan payment per month" v="601 EUR" t={t} at={40.25} />
        </div>
        <div style={{ ...text(15, 500, C.ink2), marginTop: 14, lineHeight: 1.45 }}>
          A rough comparison, not a valuation.
          <br />
          Not financial advice.
        </div>
      </div>
      <Cursor x={curX} y={curY} press={press} size={40} opacity={ip(t, [41.5, 41.65], [0, 1])} />
      <ClickRing x={OFFER_BTN.x} y={OFFER_BTN.y} p={ip(t, [OFFER_CLICK, OFFER_CLICK + 0.4], [0, 1])} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------------------------

export const AppWindow: React.FC = () => {
  const f = useCurrentFrame();
  const t = APP_FROM + f / 60;
  const cam = camAt(t);
  // the window opens inside the lens glass (radius 300 px at the frame centre, as scene 3 leaves it)
  const open = ip(t, [APP_FROM, APP_FROM + 0.55], [0, 1], easeInOut);
  const clipR = 300 + open * 1000;
  const glassWhite = 1 - ip(t, [APP_FROM, APP_FROM + 0.2], [0, 1]);
  const leave = ip(t, [APP_TO - 0.4, APP_TO], [0, 1], (v) => v * v);
  const url =
    t < 20.65
      ? "suitespot-production.up.railway.app/research/new"
      : t < 28.2
        ? "suitespot-production.up.railway.app/research/run"
        : t < 38.7
          ? "suitespot-production.up.railway.app/research/results"
          : "suitespot-production.up.railway.app/research/candidate";
  // the page change after the click: a white circle from the button covers the page, the run grows in
  const wipe = ip(t, [20.3, 20.62], [0, 1], easeInOut); // the circle only grows
  const wipeFade = 1 - ip(t, [20.62, 20.9], [0, 1]); // then fades in place, it never shrinks back
  const lensBox = (1000 * clipR) / 300;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", clipPath: open < 1 ? `circle(${clipR}px at 960px 540px)` : undefined }}>
        <div
          style={{
            width: W,
            height: H,
            translate: `${-cam.fx * cam.scale}px ${-cam.fy * cam.scale}px`,
            scale: String(cam.scale),
            transform: undefined,
            opacity: 1 - leave,
            filter: leave > 0 ? `blur(${leave * 14}px)` : undefined,
          }}
        >
          <BrowserWindow width={W} height={H} url={url}>
            <div style={{ position: "absolute", inset: 0, opacity: vis(t, 14.0, 20.7, 0.01) }}>
              <NewResearch t={t + 0.5} />
            </div>
            <div style={{ position: "absolute", inset: 0, opacity: vis(t, 20.6, 28.3, 0.15) }}>{t > 20.55 && t < 28.35 ? <RunPage t={t + 0.5} /> : null}</div>
            <div style={{ position: "absolute", inset: 0, opacity: vis(t, 28.22, 32.42, 0.13) }}>{t > 28.2 && t < 32.5 ? <TimelinePage t={t} /> : null}</div>
            <div style={{ position: "absolute", inset: 0, opacity: vis(t, 32.38, 36.7, 0.12) }}>{t > 32.35 && t < 36.8 ? <ReportPage t={t - 1.3} /> : null}</div>
            <div style={{ position: "absolute", inset: 0, opacity: vis(t, 36.66, 38.85, 0.12) }}>{t > 36.6 && t < 38.9 ? <ListPage t={t} /> : null}</div>
            <div style={{ position: "absolute", inset: 0, opacity: vis(t, 38.68, 44, 0.04) }}>{t > 38.6 ? <CandidatePage t={t} /> : null}</div>
            {wipe > 0 && wipeFade > 0 ? <div style={{ position: "absolute", left: 990 - 1900 * wipe, top: 382 - 1900 * wipe, width: 3800 * wipe, height: 3800 * wipe, borderRadius: 9999, background: "white", opacity: 0.88 * wipeFade }} /> : null}
          </BrowserWindow>
        </div>
        {glassWhite > 0 ? <AbsoluteFill style={{ background: "white", opacity: glassWhite }} /> : null}
      </AbsoluteFill>
      {/* the lens ring opens with the window and fades out */}
      {open < 1 ? (
        <div
          style={{
            position: "absolute",
            left: 960 - lensBox * (212 / 480),
            top: 540 - lensBox * (212 / 480),
            width: lensBox,
            height: lensBox,
            opacity: 1 - ip(t, [APP_FROM + 0.2, APP_FROM + 0.55], [0, 1]),
          }}
        >
          <Lens size={lensBox} building={null} hollow />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** where the Make an offer button sits on screen at the click (for the deal card of scene 8) */
export function offerButtonOnScreen() {
  const c = camAt(OFFER_CLICK);
  return { x: (OFFER_BTN.x - 800 - c.fx) * c.scale, y: (OFFER_BTN.y + 58 - 470 - c.fy) * c.scale, scale: c.scale };
}
