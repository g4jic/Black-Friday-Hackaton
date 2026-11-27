import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Check, Send, CreditCard, KeyRound } from "lucide-react";
import { C, fontFamily, ip, easeInOut, GLASS_STRONG } from "../lib";
import { ClickRing, Cursor, DarkPill } from "../ui";
import { offerButtonOnScreen } from "./AppWindow";

/**
 * Scene 8 (44.4 s to 50.4 s): the financial loop closes in three cards. Make an offer (Send offer), the offer
 * (Offer sent, Accepted, Lease signed, Pay rent), then the rent payment (Opening checkout, Paid). On each click the
 * card slides away to the left and the next one comes in from the right. Strings are the app's own
 * (web/src/deals/DealViews.tsx). The first card grows out of the Make an offer button clicked on the candidate page.
 * Its clock starts at 44.4 s (the sequence itself starts at 42.3 s of the video).
 */
export const DEAL_FROM = 44.4;
const T = (f: number) => DEAL_FROM + f / 60;

const W = 760; // card width before the scale
const SC = 1.45; // the cards' scale on screen
const SEND_CLICK = 45.15;
const SWAP1: [number, number] = [45.26, 45.78];
const ACCEPTED = 46.15;
const SIGNED = 46.7;
const PAY_CLICK = 47.3;
const SWAP2: [number, number] = [47.4, 47.92];
const PAID = 48.15;
const SLIDE = 900; // screen px a card travels on a swap

const txt = (size: number, weight = 400, color: string = C.ink): React.CSSProperties => ({ fontFamily, fontSize: size, fontWeight: weight, color });

/** a point in a centred card (card px) on the screen */
const onScreen = (lx: number, ly: number, h: number) => ({ x: 960 + (lx - W / 2) * SC, y: 540 + (ly - h / 2) * SC });

const cardBase: React.CSSProperties = {
  position: "absolute",
  left: 960 - W / 2,
  width: W,
  borderRadius: 34,
  overflow: "hidden",
  ...GLASS_STRONG,
  background: "rgba(255,255,255,0.97)",
  boxShadow: "0 40px 100px rgba(90,40,70,0.25), inset 0 1px 0 white",
};

/** one swap: the old card leaves to the left, the new one arrives from the right (q 0..1) */
const leaving = (q: number): React.CSSProperties => {
  const k = easeInOut(ip(q, [0, 0.55], [0, 1], lin));
  return { translate: `${-k * SLIDE}px 0px`, opacity: 1 - ip(k, [0.6, 1], [0, 1], lin), scale: String(SC * (1 - k * 0.06)) };
};
const arriving = (q: number): React.CSSProperties => {
  const k = easeInOut(ip(q, [0.2, 1], [0, 1], lin));
  return { translate: `${(1 - k) * SLIDE}px 0px`, opacity: ip(k, [0, 0.35], [0, 1], lin), scale: String(SC * (0.94 + k * 0.06)) };
};

const lin = (v: number) => v;
const pop = (t: number, at: number) => ip(t, [at, at + 0.2], [0.6, 1]);

export const S8Deal: React.FC = () => {
  const f = useCurrentFrame();
  const t = T(f);
  const press = (c: number) => ip(t, [c - 0.05, c], [0, 1]) * (1 - ip(t, [c + 0.06, c + 0.2], [0, 1]));
  const q1 = ip(t, SWAP1, [0, 1], lin);
  const q2 = ip(t, SWAP2, [0, 1], lin);

  // card A: Make an offer, grown out of the button on the candidate page
  const btn = offerButtonOnScreen();
  const grow = ip(t, [44.4, 44.9], [0, 1], easeInOut);
  const lighten = ip(t, [44.5, 44.82], [0, 1]);
  const aIn = ip(t, [44.75, 44.95], [0, 1]);
  const A_H = 470;
  const aW = 200 + (W - 200) * grow;
  const aH = 48 + (A_H - 48) * grow;
  const aScale = btn.scale + (SC - btn.scale) * grow;

  // card B: the offer
  const B_H = 300;
  const signed = ip(t, [SIGNED, SIGNED + 0.2], [0, 1]);
  const unsigned = 1 - ip(t, [SIGNED - 0.14, SIGNED], [0, 1]);

  // card C: the rent payment; at the end it turns coral and collapses into the dot that floods scene 9
  const C_H = 300;
  const paid = ip(t, [PAID, PAID + 0.25], [0, 1]);
  const out = ip(t, [49.82, 50.12], [0, 1], easeInOut);
  const tint = ip(t, [49.86, 50.04], [0, 1]);

  // the cursor, in screen px: Send offer, then Pay rent
  const send = onScreen(132, 414, A_H);
  const pay = onScreen(625, 206, B_H);
  const first = t < 46.3;
  const cx = first ? ip(t, [44.7, 45.05], [send.x + 300, send.x], easeInOut) : ip(t, [46.9, 47.22], [pay.x + 260, pay.x], easeInOut);
  const cy = first ? ip(t, [44.7, 45.05], [send.y + 150, send.y], easeInOut) : ip(t, [46.9, 47.22], [pay.y + 180, pay.y], easeInOut);
  const cOp = first ? ip(t, [44.7, 44.8], [0, 1]) * (1 - ip(t, [45.3, 45.45], [0, 1])) : ip(t, [46.9, 47.0], [0, 1]) * (1 - ip(t, [47.42, 47.57], [0, 1]));

  return (
    <AbsoluteFill style={{ fontFamily }}>
      {/* A: Make an offer */}
      {q1 < 1 ? (
        <div
          style={{
            ...cardBase,
            top: 540 - aH / 2,
            left: 960 - aW / 2,
            width: aW,
            height: aH,
            borderRadius: 24 + 10 * grow,
            background: `rgba(${Math.round(11 + 244 * lighten)},${Math.round(11 + 244 * lighten)},${Math.round(15 + 240 * lighten)},${0.86 + 0.11 * lighten})`,
            padding: "34px 40px",
            ...(q1 > 0 ? leaving(q1) : { translate: `${btn.x * (1 - grow)}px ${btn.y * (1 - grow)}px`, scale: String(aScale) }),
          }}
        >
          {lighten < 1 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: 1 - lighten, ...txt(18, 600, "white"), whiteSpace: "nowrap" }}>
              <Send size={18} />
              Make an offer
            </div>
          ) : null}
          <div style={{ opacity: aIn, width: W - 80 }}>
            <div style={txt(16, 500, C.ink2)}>Make an offer</div>
            <div style={{ ...txt(34, 700), letterSpacing: "-0.02em" }}>Palilula · 45 m2</div>
            <div style={{ marginTop: 26 }}>
              {[
                ["Monthly rent you offer (EUR)", "790"],
                ["Months", "36"],
                ["Message (optional)", "Design studio, five people, client meetings"],
              ].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 14 }}>
                  <div style={{ ...txt(15, 500, C.ink2), marginBottom: 6 }}>{l}</div>
                  <div style={{ height: 46, borderRadius: 99, background: "white", boxShadow: "inset 0 0 0 1px rgba(90,46,80,0.12)", display: "flex", alignItems: "center", padding: "0 20px", ...txt(18, 500) }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", left: 40, bottom: 30, height: 52, padding: "0 26px", borderRadius: 99, background: C.ink, display: "flex", alignItems: "center", gap: 10, ...txt(19, 600, "white"), scale: String(1 - press(SEND_CLICK) * 0.06) }}>
              <Send size={19} />
              Send offer
            </div>
          </div>
        </div>
      ) : null}

      {/* B: the offer, Offer sent -> Accepted -> Lease signed, then Pay rent */}
      {q1 > 0 && q2 < 1 ? (
        <div style={{ ...cardBase, top: 540 - B_H / 2, height: B_H, ...(q2 > 0 ? leaving(q2) : arriving(q1)) }}>
          <div style={{ position: "absolute", left: 40, top: 32, ...txt(16, 500, C.ink2), whiteSpace: "nowrap" }}>
            <span style={{ opacity: unsigned }}>Your offer</span>
            <span style={{ position: "absolute", left: 0, opacity: signed }}>Spaces I rent</span>
          </div>
          <div style={{ position: "absolute", left: 40, top: 54, ...txt(34, 700), letterSpacing: "-0.02em" }}>Palilula · 45 m2</div>
          <div style={{ position: "absolute", right: 40, top: 40 }}>
            {t < ACCEPTED ? (
              <DarkPill icon={Send} text="Offer sent" fontSize={18} />
            ) : t < SIGNED ? (
              <div style={{ scale: String(pop(t, ACCEPTED)) }}>
                <DarkPill icon={Check} text="Accepted" bg={C.green700} fontSize={18} />
              </div>
            ) : (
              <div style={{ scale: String(pop(t, SIGNED)) }}>
                <DarkPill icon={KeyRound} text="Lease signed" bg={C.ink} fontSize={18} />
              </div>
            )}
          </div>
          <div style={{ position: "absolute", left: 40, top: 112, ...txt(18, 400, C.ink2) }}>790 EUR per month · 36 months</div>
          <div style={{ position: "absolute", left: 40, top: 160, width: W - 80, height: 92, borderRadius: 22, background: "white", boxShadow: "inset 0 0 0 1px rgba(90,46,80,0.12)" }}>
            <div style={{ position: "absolute", left: 22, top: 18, ...txt(20, 600) }}>December 2026</div>
            <div style={{ position: "absolute", left: 22, top: 50, ...txt(16, 400, C.ink2) }}>790 EUR</div>
            <div style={{ position: "absolute", right: 22, top: 34, ...txt(16, 500, C.ink3), opacity: unsigned }}>Due once the lease is signed</div>
            <div
              style={{
                position: "absolute",
                right: 20,
                top: 21,
                height: 50,
                padding: "0 24px",
                borderRadius: 99,
                background: C.ink,
                display: "flex",
                alignItems: "center",
                gap: 10,
                ...txt(18, 600, "white"),
                opacity: signed,
                scale: String((0.9 + signed * 0.1) * (1 - press(PAY_CLICK) * 0.06)),
              }}
            >
              <CreditCard size={19} />
              Pay rent
            </div>
          </div>
        </div>
      ) : null}

      {/* C: the rent payment */}
      {q2 > 0 && t < 50.14 ? (
        <div
          style={{
            ...cardBase,
            top: 540 - C_H / 2,
            height: C_H,
            borderRadius: 34 + 300 * tint,
            ...arriving(q2),
            ...(out > 0 ? { scale: String(SC * (1 - out * 0.9)), opacity: 1 - ip(t, [50.06, 50.14], [0, 1]) } : {}),
          }}
        >
          <div style={{ position: "absolute", left: 40, top: 32, ...txt(16, 500, C.ink2) }}>Pay rent</div>
          <div style={{ position: "absolute", left: 40, top: 54, ...txt(34, 700), letterSpacing: "-0.02em" }}>Palilula · 45 m2</div>
          <div style={{ position: "absolute", right: 40, top: 40 }}>
            <DarkPill icon={KeyRound} text="Lease signed" bg={C.ink} fontSize={18} />
          </div>
          <div style={{ position: "absolute", left: 40, top: 112, ...txt(18, 400, C.ink2), opacity: 1 - paid }}>790 EUR due for December 2026</div>
          <div style={{ position: "absolute", left: 40, top: 112, ...txt(18, 600, C.green700), opacity: paid }}>Rent for December 2026 paid: 790 EUR.</div>
          <div
            style={{
              position: "absolute",
              left: 40,
              top: 160,
              width: W - 80,
              height: 92,
              borderRadius: 22,
              background: paid > 0 ? C.green50 : "white",
              boxShadow: paid > 0 ? `inset 0 0 0 ${paid * 3}px ${C.green700}` : "inset 0 0 0 1px rgba(90,46,80,0.12)",
            }}
          >
            <div style={{ position: "absolute", left: 22, top: 18, ...txt(20, 600) }}>December 2026</div>
            <div style={{ position: "absolute", left: 22, top: 50, ...txt(16, 400, C.ink2) }}>790 EUR</div>
            {t < PAID ? (
              <div style={{ position: "absolute", right: 20, top: 21, height: 50, padding: "0 24px", borderRadius: 99, background: C.ink, display: "flex", alignItems: "center", gap: 10, ...txt(18, 600, "white") }}>
                <CreditCard size={19} />
                Opening checkout...
              </div>
            ) : (
              <div style={{ position: "absolute", right: 22, top: 25, display: "flex", alignItems: "center", gap: 10, ...txt(22, 700, C.green700), scale: String(ip(t, [PAID, PAID + 0.2], [0.5, 1])) }}>
                <div style={{ width: 40, height: 40, borderRadius: 99, background: C.green700, display: "grid", placeItems: "center" }}>
                  <Check size={24} color="white" strokeWidth={3} />
                </div>
                Paid
              </div>
            )}
          </div>
          {tint > 0 ? <div style={{ position: "absolute", inset: 0, background: C.brand, opacity: tint }} /> : null}
        </div>
      ) : null}

      {cOp > 0 ? <Cursor x={cx} y={cy} press={press(first ? SEND_CLICK : PAY_CLICK)} size={56} opacity={cOp} /> : null}
      <ClickRing x={first ? send.x : pay.x} y={first ? send.y : pay.y} p={ip(t, first ? [SEND_CLICK, SEND_CLICK + 0.4] : [PAY_CLICK, PAY_CLICK + 0.4], [0, 1])} />
    </AbsoluteFill>
  );
};
