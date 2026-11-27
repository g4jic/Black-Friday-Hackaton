import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, fontFamily, ip, s, easeInOut, easeIn } from "../lib";
import { Lens } from "../ui";

/**
 * Scene 3 (starts at 11.95 s): the sign in map from the app (city blocks, a river, listings as coral dots), the lens
 * tours two listings and a building pops up with a pill, then the camera enters the lens (the welcome zoom after
 * sign in). The pills name candidates of the recorded Office in Beograd run.
 */
function rng(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) % 4294967296;
    return v / 4294967296;
  };
}
type Block = { x: number; y: number; w: number; h: number; fill: string };
function cityBlocks(): Block[] {
  const r = rng(7);
  const fills = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FBEFF4", "#F6E8F5", "#FBE5DC", "#E6F5EA"];
  const out: Block[] = [];
  for (let row = 0; row < 19; row++) {
    for (let col = 0; col < 32; col++) {
      if (r() < 0.12) continue;
      const w = 44 + r() * 34;
      const h = 50 + r() * 30;
      out.push({ x: col * 74 + (row % 2) * 18 + r() * 6 - 60, y: row * 74 + r() * 6 - 60, w, h, fill: fills[Math.floor(r() * fills.length)]! });
    }
  }
  return out;
}

const STOP_A = { x: -440, y: -150 };
const STOP_B = { x: 330, y: 110 };
const DOTS = [STOP_A, STOP_B, { x: -150, y: 300 }, { x: 640, y: -300 }, { x: -760, y: 230 }, { x: 120, y: -330 }, { x: 760, y: 360 }];

export const S3Map: React.FC = () => {
  const f = useCurrentFrame();
  const blocks = useMemo(cityBlocks, []);
  const toA = ip(f, [s(0.3), s(0.95)], [0, 1], easeInOut);
  const toB = ip(f, [s(1.55), s(2.2)], [0, 1], easeInOut);
  const lx = STOP_A.x * toA + (STOP_B.x - STOP_A.x) * toB;
  const ly = STOP_A.y * toA + (STOP_B.y - STOP_A.y) * toB;
  const popA = ip(f, [s(0.98), s(1.2)], [0, 1]) * (1 - ip(f, [s(1.45), s(1.6)], [0, 1]));
  const popB = ip(f, [s(2.22), s(2.45)], [0, 1]);
  // camera: arrives from the lens zoom of scene 2, then enters the lens at the end
  const arrive = ip(f, [0, s(0.4)], [0, 1]);
  const enter = ip(f, [s(2.85), s(3.6)], [0, 1], easeIn);
  const camScale = (1.35 - arrive * 0.35) * (1 + enter * 9);
  const pan = f * 0.35; // the map keeps sliding slowly, as on the sign in page
  const building = popB > 0 ? 0 : 2;
  const pop = popB > 0 ? popB : popA;
  const label = popB > 0 ? "Palilula · 45 m2" : "Karaburma · 62 m2";
  const lensSize = 280;
  return (
    <AbsoluteFill style={{ fontFamily, background: "#F6EEF6", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          scale: String(camScale),
          transformOrigin: `${960 + lx * (enter > 0 ? 1 : 1) - 18}px ${540 + ly - 18}px`,
        }}
      >
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          <g transform={`translate(${-pan} ${-pan * 0.35})`}>
            {blocks.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={b.fill} opacity={0.92} />
            ))}
            <path d="M -80 900 C 400 980, 860 760, 1150 620 S 1700 380, 2400 300" fill="none" stroke="#E2D2F6" strokeWidth={110} strokeLinecap="round" />
            <path d="M -80 900 C 400 980, 860 760, 1150 620 S 1700 380, 2400 300" fill="none" stroke="#D5BFF1" strokeWidth={8} opacity={0.8} />
          </g>
        </svg>
        {DOTS.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 960 + d.x - 10,
              top: 540 + d.y - 10,
              width: 20,
              height: 20,
              borderRadius: 99,
              background: C.brand,
              boxShadow: "0 0 0 7px rgba(255,255,255,0.75)",
              scale: String(ip(f, [s(0.1) + i * 3, s(0.35) + i * 3], [0, 1])),
            }}
          />
        ))}
        {/* the lens */}
        <div
          style={{
            position: "absolute",
            left: 960 + lx - lensSize * (212 / 480),
            top: 540 + ly - lensSize * (212 / 480),
            width: lensSize,
            height: lensSize,
            translate: `0px ${Math.sin(f / 22) * 4 * (1 - enter)}px`,
          }}
        >
          <Lens size={lensSize} building={building} buildingScale={0.4 + pop * 0.6} style={{ filter: "drop-shadow(0 24px 40px rgba(120,40,60,0.28))" }} />
          <div
            style={{
              position: "absolute",
              left: lensSize * (212 / 480),
              top: -22,
              translate: "-50% 0",
              scale: String(0.6 + pop * 0.4),
              opacity: pop * (1 - enter * 4),
              height: 46,
              padding: "0 20px",
              borderRadius: 99,
              background: "white",
              boxShadow: `inset 0 0 0 2px ${C.brandSoft}, 0 8px 20px rgba(90,46,80,0.12)`,
              display: "flex",
              alignItems: "center",
              fontSize: 22,
              fontWeight: 600,
              color: C.ink,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "white", opacity: Math.max(1 - ip(f, [0, s(0.3)], [0, 1]), ip(f, [s(3.35), s(3.6)], [0, 1])) }} />
    </AbsoluteFill>
  );
};

export const S3_ENTER_END = s(3.6);
void easeInOut;
