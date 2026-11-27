import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Check, Send, CreditCard, KeyRound } from "lucide-react";
import { C, fontFamily, ip, easeInOut, GLASS_STRONG } from "../lib";
import { ClickRing, Cursor, DarkPill } from "../ui";

/**
 * Scene 8 (44.4 s to 50.4 s): the financial loop closes on one card. Make an offer, accepted, the lease, Pay rent on
 * the simulated checkout (no real money), Paid. Strings are the app's own (web/src/deals/DealViews.tsx).
 */
export const DEAL_FROM = 44.4;
const T = (f: number) => DEAL_FROM + f / 60;

const txt = (size: number, weight = 400, color: string = C.ink): React.CSSProperties => ({ fontFamily, fontSize: size, fontWeight: weight, color });

export const S8Deal: React.FC = () => {
  const f = useCurrentFrame();
  const t = T(f);
  const cardIn = ip(t, [44.45, 44.85], [0, 1]);
  const offerClick = 45.15;
  const payClick = 47.3;
  const stage = t < 45.3 ? 0 : t < 46.15 ? 1 : t < 46.7 ? 2 : t < 47.75 ? 3 : t < 48.15 ? 4 : 5;
  // a quick flip between stages: the card turns on Y and lands on the next state
  const flips = [45.3, 46.7, 47.75];
  let flip = 0;
  for (const a of flips) flip += Math.sin(ip(t, [a - 0.12, a + 0.12], [0, Math.PI], easeInOut)) * 14;
  const out = ip(t, [50.05, 50.35], [0, 1]);
  const cursorX = t < 46 ? ip(t, [44.7, 45.05], [1000, 712], easeInOut) : ip(t, [46.9, 47.22], [1400, 1196], easeInOut);
  const cursorY = t < 46 ? ip(t, [44.7, 45.05], [900, 722], easeInOut) : ip(t, [46.9, 47.22], [760, 524], easeInOut);
  const press = (c: number) => ip(t, [c - 0.05, c], [0, 1]) * (1 - ip(t, [c + 0.06, c + 0.2], [0, 1]));
  const cursorOn = (t > 44.7 && t < 45.45) || (t > 46.9 && t < 47.5);
  const paid = ip(t, [48.15, 48.4], [0, 1]);
  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center", perspective: 2000 }}>
      <div
        style={{
          width: 760,
          height: 470,
          borderRadius: 34,
          ...GLASS_STRONG,
          background: "rgba(255,255,255,0.86)",
          boxShadow: "0 40px 100px rgba(90,40,70,0.25), inset 0 1px 0 white",
          padding: "34px 40px",
          position: "relative",
          opacity: cardIn * (1 - out),
          scale: String(1.45 * (0.85 + cardIn * 0.15) * (1 - out * 0.4)),
          transform: `rotateX(${(1 - cardIn) * 20 + 4}deg) rotateY(${flip - 6}deg)`,
          filter: `blur(${(1 - cardIn) * 12}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={txt(16, 500, C.ink2)}>{stage < 3 ? "Make an offer" : stage < 5 ? "Spaces I rent" : "Spaces I rent"}</div>
            <div style={{ ...txt(34, 700), letterSpacing: "-0.02em" }}>Palilula · 45 m2</div>
          </div>
          {stage >= 1 && stage < 3 ? (
            <div style={{ scale: String(ip(t, [stage === 1 ? 45.3 : 46.15, (stage === 1 ? 45.3 : 46.15) + 0.2], [0.6, 1])) }}>
              {stage === 1 ? <DarkPill icon={Send} text="Offer sent" fontSize={18} /> : <DarkPill icon={Check} text="Accepted" bg={C.green700} fontSize={18} />}
            </div>
          ) : null}
          {stage >= 3 ? <DarkPill icon={KeyRound} text="Lease signed" bg={C.ink} fontSize={18} /> : null}
        </div>

        {stage < 3 ? (
          <div style={{ marginTop: 26 }}>
            {[
              ["Monthly rent you offer (EUR)", "790"],
              ["Months", "36"],
              ["Message (optional)", "Design studio, five people, client meetings"],
            ].map(([l, v]) => (
              <div key={l} style={{ marginBottom: 14 }}>
                <div style={{ ...txt(15, 500, C.ink2), marginBottom: 6 }}>{l}</div>
                <div style={{ height: 46, borderRadius: 99, background: "white", display: "flex", alignItems: "center", padding: "0 20px", ...txt(18, 500) }}>{v}</div>
              </div>
            ))}
            <div style={{ position: "absolute", left: 40, bottom: 30, height: 52, padding: "0 26px", borderRadius: 99, background: stage === 0 ? C.ink : "#3A3A44", display: "flex", alignItems: "center", gap: 10, ...txt(19, 600, "white"), scale: String(1 - press(offerClick) * 0.06) }}>
              <Send size={19} />
              {stage === 0 ? "Send offer" : "Offer sent"}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 26 }}>
            <div style={txt(18, 400, C.ink2)}>790 EUR per month · 36 months · rent due on both sides</div>
            <div style={{ marginTop: 24, height: 86, borderRadius: 22, background: paid > 0 ? C.green50 : "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", boxShadow: paid > 0 ? `0 0 0 ${paid * 3}px ${C.green700}` : undefined }}>
              <div>
                <div style={txt(20, 600)}>December 2026</div>
                <div style={txt(16, 400, C.ink2)}>790 EUR</div>
              </div>
              {stage < 5 ? (
                <div style={{ height: 50, padding: "0 24px", borderRadius: 99, background: C.ink, display: "flex", alignItems: "center", gap: 10, ...txt(18, 600, "white"), scale: String(1 - press(payClick) * 0.06) }}>
                  <CreditCard size={19} />
                  {stage === 4 ? "Opening checkout..." : "Pay rent"}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, ...txt(22, 700, C.green700), scale: String(ip(t, [48.15, 48.35], [0.5, 1])) }}>
                  <div style={{ width: 40, height: 40, borderRadius: 99, background: C.green700, display: "grid", placeItems: "center" }}>
                    <Check size={24} color="white" strokeWidth={3} />
                  </div>
                  Paid
                </div>
              )}
            </div>
            <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", height: 40, padding: "0 16px", borderRadius: 99, background: C.lilac100, ...txt(16, 600, C.lilac600) }}>
              Simulated payment, no real money
            </div>
            {stage === 5 ? <div style={{ ...txt(17, 500, C.green700), marginTop: 14, opacity: paid }}>Rent for December 2026 paid: 790 EUR.</div> : null}
          </div>
        )}
        {cursorOn ? <Cursor x={cursorX - 580} y={cursorY - 305} press={press(t < 46 ? offerClick : payClick)} size={44} /> : null}
        <ClickRing x={(t < 46 ? 712 : 1196) - 580} y={(t < 46 ? 722 : 524) - 305} p={ip(t, t < 46 ? [offerClick, offerClick + 0.4] : [payClick, payClick + 0.4], [0, 1])} />
      </div>
    </AbsoluteFill>
  );
};
