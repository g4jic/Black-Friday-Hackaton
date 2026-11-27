import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Calculator, FileText, MapPin, Building2, Search, PenLine, ShieldCheck, ListOrdered, type LucideIcon } from "lucide-react";
import { APP_GRADIENT, C, fontFamily, ip } from "./lib";
import { AUTH_BUILDINGS } from "./auth-buildings";

export const Background: React.FC = () => <AbsoluteFill style={{ background: APP_GRADIENT }} />;

/** Word by word reveal: each word rises, unblurs and fades in. `at` is the local frame of the first word. */
export const Words: React.FC<{
  text: string;
  at: number;
  step?: number;
  dur?: number;
  style?: React.CSSProperties;
  accent?: string[];
  accentColor?: string;
  rise?: number;
}> = ({ text, at, step = 5, dur = 18, style, accent = [], accentColor = C.brand, rise = 34 }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((w, i) => {
        const a = at + i * step;
        const clean = w.replace(/[.,:]/g, "");
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: ip(f, [a, a + dur * 0.6], [0, 1]),
              translate: `0px ${ip(f, [a, a + dur], [rise, 0])}px`,
              filter: `blur(${ip(f, [a, a + dur * 0.8], [12, 0])}px)`,
              color: accent.includes(clean) ? accentColor : undefined,
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
};

/** The SuiteSpot lens (the logo's magnifying glass), drawn from the same 480 viewBox; building index from the sign in map. */
export const Lens: React.FC<{ size: number; building?: number | null; buildingScale?: number; style?: React.CSSProperties; handle?: boolean }> = ({
  size,
  building = 0,
  buildingScale = 1,
  style,
  handle = true,
}) => {
  const b = building === null ? null : AUTH_BUILDINGS[building % AUTH_BUILDINGS.length];
  return (
    <svg viewBox="0 0 480 480" width={size} height={size} style={{ overflow: "visible", ...style }}>
      <defs>
        <radialGradient id="lensFill" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.65" stopColor="#FBF1F8" />
          <stop offset="1" stopColor="#EEE3FB" />
        </radialGradient>
        <linearGradient id="lensCoral" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7A48C" />
          <stop offset="0.55" stopColor="#F25C54" />
          <stop offset="1" stopColor="#E5483F" />
        </linearGradient>
        <linearGradient id="lensInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E2E38" />
          <stop offset="1" stopColor="#0B0B0F" />
        </linearGradient>
        <clipPath id="lensClip">
          <circle cx="212" cy="212" r="146" />
        </clipPath>
      </defs>
      {handle ? <line x1="337.9" y1="337.9" x2="388.8" y2="388.8" stroke="url(#lensInk)" strokeWidth={64} strokeLinecap="round" /> : null}
      <circle cx="212" cy="212" r="164" fill="url(#lensFill)" />
      {b ? (
        <g clipPath="url(#lensClip)">
          <g style={{ transformOrigin: "212px 250px", scale: String(buildingScale) }}>
            {b.polygons.map(([points, fill], i) => (
              <polygon key={i} points={points} fill={fill} />
            ))}
          </g>
        </g>
      ) : null}
      <path d="M 88 184 A 124 124 0 0 1 184 88" fill="none" stroke="#fff" strokeWidth={14} strokeLinecap="round" opacity={0.9} />
      <circle cx="212" cy="212" r="164" fill="none" stroke="url(#lensCoral)" strokeWidth={40} />
    </svg>
  );
};

/** The app's own cursor (web/public/cursor.svg), tip at the top left. */
export const Cursor: React.FC<{ x: number; y: number; press?: number; size?: number; opacity?: number }> = ({ x, y, press = 0, size = 46, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x - size * 0.12, top: y - size * 0.1, width: size, height: size, opacity, scale: String(1 - press * 0.14), transformOrigin: "12% 10%" }}>
    <Img src={staticFile("img/cursor.svg")} style={{ width: size, height: size }} />
  </div>
);

/** A click ring at the cursor tip, `p` is 0..1 progress of the ring. */
export const ClickRing: React.FC<{ x: number; y: number; p: number; color?: string }> = ({ x, y, p, color = C.brand }) =>
  p <= 0 || p >= 1 ? null : (
    <div
      style={{
        position: "absolute",
        left: x - 40,
        top: y - 40,
        width: 80,
        height: 80,
        borderRadius: 999,
        border: `3px solid ${color}`,
        opacity: 1 - p,
        scale: String(0.3 + p * 0.9),
      }}
    />
  );

/** A macOS style floating browser window. Content is laid out at width x height (CSS px). */
export const BrowserWindow: React.FC<{ width: number; height: number; url: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  width,
  height,
  url,
  children,
  style,
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: 30,
      overflow: "hidden",
      position: "relative",
      background: "rgba(255,255,255,0.35)",
      boxShadow: "0 50px 120px rgba(90,40,70,0.28), 0 18px 40px rgba(90,40,70,0.14), inset 0 0 0 1.5px rgba(255,255,255,0.55)",
      ...style,
    }}
  >
    <div
      style={{
        height: 58,
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 10,
        background: "rgba(255,255,255,0.72)",
        position: "relative",
        zIndex: 2,
      }}
    >
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <div key={c} style={{ width: 15, height: 15, borderRadius: 99, background: c }} />
      ))}
      <div
        style={{
          position: "absolute",
          left: "50%",
          translate: "-50% 0",
          height: 36,
          padding: "0 22px",
          borderRadius: 99,
          background: "rgba(11,11,15,0.05)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily,
          fontSize: 17,
          color: C.ink2,
          fontWeight: 500,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="2.4">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {url}
      </div>
    </div>
    <div style={{ position: "absolute", top: 58, left: 0, right: 0, bottom: 0, background: APP_GRADIENT, overflow: "hidden" }}>{children}</div>
  </div>
);

export const AGENT_ICONS: Record<string, LucideIcon> = {
  "Finance analyst": Calculator,
  "Lease reader": FileText,
  "Location analyst": MapPin,
  "Premises inspector": Building2,
  Scout: Search,
  "Report writer": PenLine,
  Auditor: ShieldCheck,
  Ranker: ListOrdered,
};

/** Dark pill with an icon: the accent used for short "what is happening" labels. */
export const DarkPill: React.FC<{ icon?: LucideIcon; text: string; style?: React.CSSProperties; bg?: string; fontSize?: number }> = ({
  icon: Icon,
  text,
  style,
  bg = C.ink,
  fontSize = 22,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      height: fontSize * 2.1,
      padding: `0 ${fontSize * 0.9}px 0 ${Icon ? fontSize * 0.7 : fontSize * 0.9}px`,
      borderRadius: 999,
      background: bg,
      color: "white",
      fontFamily,
      fontWeight: 600,
      fontSize,
      whiteSpace: "nowrap",
      boxShadow: "0 10px 30px rgba(11,11,15,0.18)",
      ...style,
    }}
  >
    {Icon ? <Icon size={fontSize * 1.05} strokeWidth={2.3} /> : null}
    {text}
  </div>
);

/** The tiny source label after every number (DESIGN.md 6.6). */
export const Src: React.FC<{ k: string; size?: number; style?: React.CSSProperties }> = ({ k, size = 13, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: size * 1.55,
      padding: `0 ${size * 0.55}px`,
      borderRadius: 99,
      background: "rgba(255,255,255,0.9)",
      boxShadow: "inset 0 0 0 1px rgba(11,11,15,0.08)",
      fontFamily,
      fontWeight: 500,
      fontSize: size,
      color: C.ink2,
      marginLeft: size * 0.6,
      verticalAlign: "middle",
      ...style,
    }}
  >
    {k}
  </span>
);

/** Title pill used on section cards (DESIGN.md 6.3). */
export const TitlePill: React.FC<{ text: string; size?: number; count?: number }> = ({ text, size = 22, count }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: `${size * 0.36}px ${size * 0.8}px`,
      borderRadius: 999,
      background: "white",
      boxShadow: "0 2px 8px rgba(90,46,80,0.06)",
      fontFamily,
      fontWeight: 600,
      fontSize: size,
      letterSpacing: "-0.015em",
      color: C.ink,
    }}
  >
    {text}
    {count !== undefined ? (
      <span style={{ width: size * 1.1, height: size * 1.1, borderRadius: 99, background: C.brand, fontSize: size * 0.62, display: "grid", placeItems: "center" }}>{count}</span>
    ) : null}
  </div>
);
