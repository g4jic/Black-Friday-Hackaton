import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, fontFamily, ip, s, easeInOut } from "../lib";
import { Lens } from "../ui";

/**
 * Scene 3 (11.95 s to 14.97 s): the sign in map from the app (calm city blocks, a river, listings as coral dots), the
 * lens tours two listings and a building pops up with a pill. Then the lens glides to the centre and grows while the
 * map dissolves; its white glass is where the app window opens (AppWindow picks up the same lens geometry).
 * The pills name candidates of the recorded Office in Beograd run.
 */
function rng(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) % 4294967296;
    return v / 4294967296;
  };
}
type Block = { x: number; y: number; w: number; h: number; fill: string };
/** a calm street grid: regular blocks, three close tints, no jitter */
function cityBlocks(): Block[] {
  const r = rng(7);
  const fills = ["#FFFFFF", "#FFFFFF", "#FCF4F8", "#F9EEF6"];
  const out: Block[] = [];
  const step = 112;
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 22; col++) {
      if (r() < 0.07) continue;
      const wide = r() < 0.25;
      out.push({ x: col * step - 90, y: row * step - 90, w: wide ? step * 2 - 22 : step - 22, h: step - 22, fill: fills[Math.floor(r() * fills.length)]! });
      if (wide) col++;
    }
  }
  return out;
}

const STOP_A = { x: -440, y: -150 };
const STOP_B = { x: 330, y: 110 };
const DOTS = [STOP_A, STOP_B, { x: -150, y: 300 }, { x: 640, y: -300 }, { x: -760, y: 230 }, { x: 120, y: -330 }, { x: 760, y: 360 }];

/** the lens box size and glass radius at the hand off to the app window */
export const LENS_END_BOX = 1000;
export const S3_END = 3.02; // local seconds

export const S3Map: React.FC = () => {
  const f = useCurrentFrame();
  const blocks = useMemo(cityBlocks, []);
  const toA = ip(f, [s(0.3), s(0.95)], [0, 1], easeInOut);
  const toB = ip(f, [s(1.55), s(2.2)], [0, 1], easeInOut);
  const toC = ip(f, [s(2.5), s(3.02)], [0, 1], easeInOut);
  const lx = (STOP_A.x * toA + (STOP_B.x - STOP_A.x) * toB) * (1 - toC);
  const ly = (STOP_A.y * toA + (STOP_B.y - STOP_A.y) * toB) * (1 - toC);
  const popA = ip(f, [s(0.98), s(1.2)], [0, 1]) * (1 - ip(f, [s(1.45), s(1.6)], [0, 1]));
  const popB = ip(f, [s(2.22), s(2.45)], [0, 1]) * (1 - ip(f, [s(2.55), s(2.8)], [0, 1]));
  const arrive = ip(f, [0, s(0.4)], [0, 1]);
  const camScale = 1.35 - arrive * 0.35;
  const pan = f * 0.35; // the map keeps sliding slowly, as on the sign in page
  const building = f >= s(2.0) ? 0 : 2;
  const pop = f >= s(2.0) ? popB : popA;
  const label = f >= s(2.0) ? "Palilula · 45 m2" : "Karaburma · 62 m2";
  const lensSize = 280 + (LENS_END_BOX - 280) * toC;
  const mapOut = ip(f, [s(2.55), s(3.0)], [0, 1]);
  return (
    <AbsoluteFill style={{ fontFamily, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(camScale), transformOrigin: `${960 + lx - 18}px ${540 + ly - 18}px` }}>
        <AbsoluteFill style={{ background: "#F6EEF6", opacity: 1 - mapOut, filter: mapOut > 0 ? `blur(${mapOut * 8}px)` : undefined }}>
          <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
            <g transform={`translate(${-pan} ${-pan * 0.35})`}>
              {blocks.map((b, i) => (
                <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={b.fill} />
              ))}
              <path d="M -80 900 C 400 980, 860 760, 1150 620 S 1700 380, 2400 300" fill="none" stroke="#E6D8F7" strokeWidth={110} strokeLinecap="round" />
            </g>
          </svg>
          {DOTS.map((d, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 960 + d.x - 11,
                top: 540 + d.y - 11,
                width: 22,
                height: 22,
                borderRadius: 99,
                background: C.brand,
                boxShadow: "0 0 0 7px rgba(255,255,255,0.85), 0 6px 14px rgba(242,92,84,0.3)",
                scale: String(ip(f, [s(0.1) + i * 3, s(0.35) + i * 3], [0, 1])),
              }}
            />
          ))}
        </AbsoluteFill>
        {/* the lens */}
        <div
          style={{
            position: "absolute",
            left: 960 + lx - lensSize * (212 / 480),
            top: 540 + ly - lensSize * (212 / 480),
            width: lensSize,
            height: lensSize,
            translate: `0px ${Math.sin(f / 22) * 4 * (1 - toC)}px`,
          }}
        >
          <Lens size={lensSize} building={f >= s(2.85) ? null : building} buildingScale={f >= s(2.5) ? popB : 0.4 + pop * 0.6} style={{ filter: "drop-shadow(0 24px 40px rgba(120,40,60,0.28))" }} />
          <div
            style={{
              position: "absolute",
              left: lensSize * (212 / 480),
              top: -22,
              translate: "-50% 0",
              scale: String(0.6 + pop * 0.4),
              opacity: pop,
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
      {/* arrives from the white glass of scene 2 */}
      <AbsoluteFill style={{ background: "white", opacity: 1 - ip(f, [0, s(0.3)], [0, 1]) }} />
    </AbsoluteFill>
  );
};
