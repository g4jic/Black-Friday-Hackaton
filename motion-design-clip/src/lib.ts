import { Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/HankenGrotesk";

export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });

export const FPS = 60;
/** seconds to frames */
export const s = (sec: number) => Math.round(sec * FPS);

export const C = {
  ink: "#0B0B0F",
  ink2: "#4A4A56",
  ink3: "#5A5A66",
  brand: "#F25C54",
  brand600: "#E5483F",
  brandSoft: "#F6857B",
  brand50: "#FDE7E3",
  lilac: "#C19BE9",
  lilac600: "#8F5FD0",
  lilac100: "#EEE3FB",
  hard: "#9F1B12",
  hard50: "#FDE4E1",
  amber400: "#F5A524",
  green700: "#0B6B3A",
  green50: "#E3F7EA",
};

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 0.9, 0.4);

/** clamped interpolate with an easing (default ease-out) */
export const ip = (f: number, input: number[], output: number[], easing = easeOut) =>
  interpolate(f, input, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/** 0..1 progress between two frames */
export const prog = (f: number, a: number, b: number, easing = easeOut) => ip(f, [a, b], [0, 1], easing);

/** the app's page background (web/src/index.css, DESIGN.md 3.1) */
export const APP_GRADIENT = [
  "radial-gradient(55% 45% at 50% 42%, rgba(255, 246, 244, 0.55) 0%, rgba(255, 246, 244, 0) 100%)",
  "radial-gradient(42% 48% at 4% 96%, rgba(246, 123, 86, 0.62) 0%, rgba(246, 123, 86, 0) 100%)",
  "radial-gradient(34% 40% at 30% 62%, rgba(242, 92, 84, 0.22) 0%, rgba(242, 92, 84, 0) 100%)",
  "radial-gradient(48% 56% at 100% 0%, rgba(193, 155, 233, 0.95) 0%, rgba(193, 155, 233, 0) 100%)",
  "radial-gradient(38% 44% at 72% 38%, rgba(214, 178, 240, 0.5) 0%, rgba(214, 178, 240, 0) 100%)",
  "radial-gradient(40% 42% at 14% 6%, rgba(251, 214, 200, 0.95) 0%, rgba(251, 214, 200, 0) 100%)",
  "radial-gradient(22% 70% at 0% 50%, rgba(247, 150, 120, 0.55) 0%, rgba(247, 150, 120, 0) 100%)",
  "linear-gradient(to top right, #f7a48c 0%, #f7c3c0 38%, #f1d2e4 62%, #d9bff4 100%)",
].join(", ");

export const GLASS: React.CSSProperties = {
  background: "rgba(255,255,255,0.56)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(11,11,15,0.03)",
};
export const GLASS_STRONG: React.CSSProperties = {
  background: "rgba(255,255,255,0.8)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 10px rgba(90,46,80,0.06)",
};
