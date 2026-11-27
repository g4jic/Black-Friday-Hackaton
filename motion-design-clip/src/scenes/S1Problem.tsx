import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Receipt, TrendingUp, LogOut, Coins } from "lucide-react";
import { C, fontFamily, ip, s, easeInOut, easeIn } from "../lib";
import { Words } from "../ui";

/**
 * Scene 1 (0 - 10.3 s): the financial problem. Headline word by word, then the rent pill (the carrier) appears and
 * the hidden costs break out of it one by one. All amounts are from the recorded Office in Beograd run, Palilula 45 m2
 * (listing-bg016): rent 790 EUR, deposit 1,580 EUR, fit-out 5,000 EUR, exit after 12 months at least 2,500 EUR.
 */
export const S1Problem: React.FC = () => {
  const f = useCurrentFrame();

  // headline 0.25 - 4.0 s, leaves at 3.95 s
  const hOut = ip(f, [s(3.9), s(4.25)], [0, 1], easeIn);

  // rent pill: arrives 4.15 s, centre
  const pIn = ip(f, [s(4.15), s(4.6)], [0, 1]);
  const pillCollapse = ip(f, [s(9.95), s(10.3)], [0, 1], easeIn);

  // three hidden costs
  const W = [
    { at: s(6.35), text: "Hidden costs.", x: -470, y: -250, icon: Coins },
    { at: s(7.55), text: "Exit penalties.", x: 430, y: -235, icon: LogOut },
    { at: s(8.75), text: "Rent that keeps rising.", x: 0, y: 250, icon: TrendingUp },
  ];
  const chips = [
    { at: s(6.55), text: "Deposit 1,580 EUR", from: [-470, -250], to: [-600, -120] },
    { at: s(6.75), text: "Fit-out 5,000 EUR", from: [-470, -250], to: [-330, -110] },
    { at: s(7.8), text: "Exit after 12 months: at least 2,500 EUR", from: [430, -235], to: [470, -115] },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      {/* headline */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: 1 - hOut,
          scale: String(1 - hOut * 0.08),
          filter: `blur(${hOut * 14}px)`,
          translate: `0px ${-hOut * 60}px`,
        }}
      >
        <div style={{ fontSize: 92, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.08, textAlign: "center", width: 1500 }}>
          <Words text="A lease is one of the biggest" at={0} step={6} />
          <br />
          <Words text="financial decisions a business makes." at={s(1.55)} step={8} accent={["financial", "decisions"]} />
        </div>
      </AbsoluteFill>

      {/* small line under the pill */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - pillCollapse }}>
        <div style={{ translate: "0px 108px", fontSize: 40, fontWeight: 500, color: C.ink2, opacity: ip(f, [s(6.2), s(6.6)], [1, 0]) }}>
          <Words text="And the rent is just the start." at={s(4.25)} step={6} rise={18} />
        </div>
      </AbsoluteFill>

      {/* hidden cost words */}
      {W.map((w, i) => {
        const a = w.at;
        const dim = i < W.length - 1 ? ip(f, [W[i + 1].at, W[i + 1].at + 12], [1, 0.38]) : 1;
        const out = ip(f, [s(9.9), s(10.25)], [0, 1], easeIn);
        const p = ip(f, [a, a + 22], [0, 1]);
        const Icon = w.icon;
        return (
          <AbsoluteFill key={i} style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
            <div
              style={{
                translate: `${w.x * (1 - out)}px ${w.y * (1 - out)}px`,
                scale: String((0.6 + p * 0.4) * (1 - out * 0.7)),
                opacity: p * dim * (1 - out),
                filter: `blur(${(1 - p) * 16 + out * 10}px)`,
                display: "flex",
                alignItems: "center",
                gap: 18,
                fontSize: 78,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                textShadow: i === 1 ? `0 0 ${ip(f, [a, a + 30], [60, 18])}px rgba(242,92,84,0.55)` : undefined,
                color: i === 1 ? C.brand600 : C.ink,
              }}
            >
              <div style={{ width: 74, height: 74, borderRadius: 99, background: C.ink, display: "grid", placeItems: "center", rotate: `${(1 - p) * -40}deg` }}>
                <Icon size={38} color="white" strokeWidth={2.3} />
              </div>
              {w.text}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* rising rent line under the third word */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <svg width="760" height="200" viewBox="0 0 760 200" style={{ translate: "0px 445px", opacity: ip(f, [s(9.9), s(10.2)], [1, 0]) }}>
          <path
            d="M 10 180 L 160 160 L 300 128 L 440 100 L 580 58 L 740 18"
            fill="none"
            stroke={C.brand}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={900}
            strokeDashoffset={ip(f, [s(8.9), s(9.9)], [900, 0], easeInOut)}
          />
        </svg>
      </AbsoluteFill>

      {/* cost chips fly out of the words */}
      {chips.map((c, i) => {
        const p = ip(f, [c.at, c.at + 26], [0, 1]);
        const out = ip(f, [s(9.9), s(10.25)], [0, 1], easeIn);
        const x = c.from[0] + (c.to[0] - c.from[0]) * p;
        const y = c.from[1] + (c.to[1] - c.from[1]) * p;
        return (
          <AbsoluteFill key={i} style={{ justifyContent: "center", alignItems: "center" }}>
            <div
              style={{
                translate: `${x * (1 - out)}px ${y * (1 - out)}px`,
                opacity: p * (1 - out) * ip(f, [s(8.75), s(9.0)], [1, 0.45]),
                scale: String(0.5 + p * 0.5),
                height: 54,
                padding: "0 24px",
                borderRadius: 99,
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.85)",
                boxShadow: "0 8px 24px rgba(90,46,80,0.12)",
                fontSize: 26,
                fontWeight: 600,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {c.text}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* the rent pill: the carrier, it becomes the coral screen of scene 2 */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            opacity: pIn,
            scale: String((0.7 + pIn * 0.3) * (1 + pillCollapse * 0.1)),
            filter: `blur(${(1 - pIn) * 10}px)`,
            height: 96,
            padding: "0 42px 0 28px",
            borderRadius: 999,
            background: pillCollapse > 0 ? C.brand : C.ink,
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 44,
            fontWeight: 600,
            boxShadow: "0 24px 60px rgba(11,11,15,0.25)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Receipt size={44} strokeWidth={2.2} />
          Rent 790 EUR / month
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
