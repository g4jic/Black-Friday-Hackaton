import React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { Receipt, TrendingUp, LogOut, Coins } from "lucide-react";
import { C, fontFamily, ip, s, easeInOut, easeIn } from "../lib";
import { Words } from "../ui";

/**
 * Scene 1 (0 - 10.3 s): the financial problem. Headline word by word, then the rent pill (the carrier) appears, rises
 * to the top and the hidden costs line up under it in three centred rows. All amounts are from the recorded Office in
 * Beograd run, Palilula 45 m2 (listing-bg016): rent 790 EUR, deposit 1,580 EUR, fit-out 5,000 EUR, exit after 12
 * months at least 2,500 EUR. At the end everything folds back into the pill, which becomes the coral of scene 2.
 */
const PILL_TOP_Y = -330;

export const S1Problem: React.FC = () => {
  const f = useCurrentFrame();

  // headline 0 - 4.0 s, leaves at 3.9 s
  const hOut = ip(f, [s(3.9), s(4.25)], [0, 1], easeIn);

  // rent pill: arrives 4.15 s at the centre, rises at 6.1 s, returns to the centre for the fold at 9.9 s
  const pIn = ip(f, [s(4.15), s(4.6)], [0, 1]);
  const rise = ip(f, [s(6.05), s(6.45)], [0, 1], easeInOut);
  const fold = ip(f, [s(9.72), s(10.08)], [0, 1], easeInOut);
  const pillY = -40 * (1 - rise) + PILL_TOP_Y * rise * (1 - fold);
  const pillCollapse = ip(f, [s(10.0), s(10.25)], [0, 1], easeIn);

  // "And the rent is just the start." leaves completely before the rows come
  const subOut = ip(f, [s(5.95), s(6.25)], [0, 1], easeIn);

  // the three rows (frame centre offsets)
  const ROWS = [
    { at: s(6.35), text: "Hidden costs.", y: -150, icon: Coins, red: false },
    { at: s(7.55), text: "Exit penalties.", y: 60, icon: LogOut, red: true },
    { at: s(8.75), text: "Rent that keeps rising.", y: 270, icon: TrendingUp, red: false },
  ];
  const CHIPS = [
    { row: 0, at: s(6.6), items: ["Deposit 1,580 EUR", "Fit-out 5,000 EUR"] },
    { row: 1, at: s(7.8), items: ["Exit after 12 months: at least 2,500 EUR"] },
  ];
  // the rows fold into the pill
  const rowOut = (y: number) => ({
    translate: `0px ${y * (1 - fold)}px`,
    opacity: Math.max(0, 1 - fold * 2),
    filter: fold > 0 ? `blur(${fold * 10}px)` : undefined,
  });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.ink }}>
      {/* headline, three balanced lines in the optical centre */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: 1 - hOut,
          // the block breathes once (1.0 -> 1.02) at the end of the sentence, then leaves
          scale: String((1 - hOut * 0.08) * (1 + ip(f, [s(2.9), s(3.9)], [0, 0.02], easeInOut))),
          filter: `blur(${hOut * 14}px)`,
          translate: `0px ${-hOut * 60}px`,
        }}
      >
        <div style={{ fontSize: 108, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.06, textAlign: "center", width: 1700 }}>
          <Words text="A lease is one of the biggest" at={0} step={3} dur={16} rise={14} blur={6} />
          <br />
          {/* one gentle accent: the words warm into coral and a thin line draws under them */}
          <span style={{ position: "relative", display: "inline-block", color: interpolateColors(f, [s(2.0), s(2.5)], [C.ink, C.brand]) }}>
            <Words text="financial decisions" at={s(1.55)} step={3} dur={16} rise={14} blur={6} />
            <span style={{ position: "absolute", left: 4, bottom: 4, height: 5, borderRadius: 99, background: C.brand, width: `${ip(f, [s(2.1), s(2.65)], [0, 98], easeInOut)}%` }} />
          </span>
          <br />
          <Words text="a business makes." at={s(1.55) + 12} step={3} dur={16} rise={14} blur={6} />
        </div>
      </AbsoluteFill>

      {/* line under the pill, centred on it */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            translate: `0px ${80 - subOut * 30}px`,
            fontSize: 60,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: C.ink2,
            opacity: 1 - subOut,
            filter: subOut > 0 ? `blur(${subOut * 12}px)` : undefined,
          }}
        >
          <Words text="And the rent is just the start." at={s(4.25)} step={6} rise={22} />
        </div>
      </AbsoluteFill>

      {/* the three rows: title, then its chips (or the line) centred under it */}
      {ROWS.map((r, i) => {
        const p = ip(f, [r.at, r.at + 22], [0, 1]);
        const Icon = r.icon;
        return (
          <AbsoluteFill key={i} style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
            <div style={rowOut(r.y)}>
              <div
                style={{
                  translate: `0px ${(1 - p) * 30}px`,
                  scale: String(0.7 + p * 0.3),
                  opacity: p,
                  filter: p < 1 ? `blur(${(1 - p) * 16}px)` : undefined,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  fontSize: 72,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  textShadow: r.red ? `0 0 ${ip(f, [r.at, r.at + 30], [60, 18])}px rgba(242,92,84,0.45)` : undefined,
                  color: r.red ? C.brand600 : C.ink,
                }}
              >
                <div style={{ width: 70, height: 70, borderRadius: 99, background: C.ink, display: "grid", placeItems: "center", rotate: `${(1 - p) * -40}deg` }}>
                  <Icon size={36} color="white" strokeWidth={2.3} />
                </div>
                {r.text}
              </div>
            </div>
          </AbsoluteFill>
        );
      })}

      {CHIPS.map((c) => {
        const y = ROWS[c.row].y + 92;
        return (
          <AbsoluteFill key={c.row} style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16, ...rowOut(y) }}>
              {c.items.map((it, k) => {
                const a = c.at + k * 10;
                const p = ip(f, [a, a + 24], [0, 1]);
                return (
                  <div
                    key={it}
                    style={{
                      translate: `0px ${(1 - p) * -60}px`,
                      opacity: p,
                      scale: String(0.6 + p * 0.4),
                      height: 54,
                      padding: "0 24px",
                      borderRadius: 99,
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.88)",
                      boxShadow: "0 8px 24px rgba(90,46,80,0.12)",
                      fontSize: 26,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {it}
                  </div>
                );
              })}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* the rising rent line, drawn under "Rent that keeps rising." from its first letter to its last */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={rowOut(375)}>
        <svg width="860" height="120" viewBox="0 0 860 120" style={{ overflow: "visible" }}>
          <path
            d="M 14 104 L 190 92 L 360 74 L 520 54 L 680 34 L 830 12"
            fill="none"
            stroke={C.brand}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={900}
            strokeDashoffset={ip(f, [s(8.9), s(9.5)], [900, 0], easeInOut)}
          />
          <circle cx={830} cy={12} r={11} fill={C.brand} opacity={ip(f, [s(9.42), s(9.52)], [0, 1])} />
        </svg>
        </div>
      </AbsoluteFill>

      {/* the rent pill: the carrier, it becomes the coral screen of scene 2 */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            translate: `0px ${pillY}px`,
            opacity: pIn,
            scale: String((0.7 + pIn * 0.3) * (1 - rise * 0.08 * (1 - fold)) * (1 + pillCollapse * 0.1)),
            filter: pIn < 1 ? `blur(${(1 - pIn) * 10}px)` : undefined,
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
          {/* the label leaves before the coral flood opens inside the pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: 1 - ip(f, [s(9.96), s(10.1)], [0, 1]) }}>
            <Receipt size={44} strokeWidth={2.2} />
            Rent 790 EUR / month
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
