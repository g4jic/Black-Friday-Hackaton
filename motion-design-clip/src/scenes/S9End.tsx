import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C, fontFamily, ip, easeInOut, easeIn } from "../lib";
import { Words } from "../ui";

/**
 * Scene 9: the Paid check floods the frame in brand coral, "Know before you sign." ("sign" lands with a small jump and
 * a white underline on the hit), then the coral contracts into a small circle that becomes the logo's lens ring; small
 * logo, name, address, notice, and a gentle exit. Its clock starts at 50.05 s (the sequence starts at 47.95 s).
 */
export const END_FROM = 50.05;
export const SIGN_HIT = 52.1;
export const END_EXIT: [number, number] = [56.3, 56.85];

export const S9End: React.FC = () => {
  const f = useCurrentFrame();
  const t = END_FROM + f / 60;
  const flood = ip(t, [50.05, 50.48], [0, 1], (v) => 1 - (1 - v) ** 2); // opens fast out of the coral dot, so no frame is empty
  const shrink = ip(t, [53.55, 54.15], [0, 1], easeInOut);
  const r = flood * 1300 * (1 - shrink) + shrink * 40;
  const coralOn = t < 54.25;
  const textOut = ip(t, [53.4, 53.6], [0, 1]);
  const logoIn = ip(t, [54.05, 54.45], [0, 1]);
  const nameIn = ip(t, [54.3, 54.75], [0, 1]);
  const metaIn = ip(t, [54.6, 55.0], [0, 1]);
  const exit = ip(t, END_EXIT, [0, 1], easeIn);
  // the narrator says "SuiteSpot" (50.5 s on this clock): the logo and the name land on the coral, then make room
  const brandIn = ip(t, [50.26, 50.56], [0, 1]); // lands as the coral closes, just before the narrator says "SuiteSpot"
  const brandOut = ip(t, [51.12, 51.34], [0, 1], easeIn);
  // "sign." jumps on the hit, the underline draws under it
  const jump = Math.sin(ip(t, [SIGN_HIT - 0.05, SIGN_HIT + 0.3], [0, Math.PI])) * -18;
  const line = ip(t, [SIGN_HIT, SIGN_HIT + 0.25], [0, 1], easeInOut);
  const signAt = Math.round((51.35 - END_FROM) * 60) + 3 * 9;
  // the circle ends where the logo's lens centre sits
  const cx = 960 + shrink * -230;
  const cy = 540 + shrink * -47;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      {coralOn ? <AbsoluteFill style={{ background: C.brand, clipPath: `circle(${r}px at ${cx}px ${cy}px)` }} /> : null}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 136, fontWeight: 700, letterSpacing: "-0.04em", color: C.ink, opacity: 1 - textOut, filter: textOut > 0 ? `blur(${textOut * 14}px)` : undefined, scale: String(1 - textOut * 0.06), whiteSpace: "nowrap" }}>
          <Words text="Know before you" at={Math.round((51.35 - END_FROM) * 60)} step={9} rise={40} />{" "}
          <span style={{ display: "inline-block", position: "relative", translate: `0px ${jump}px` }}>
            <Words text="sign." at={signAt} step={9} rise={40} accent={["sign"]} accentColor="#FFFFFF" />
            <span style={{ position: "absolute", left: 4, bottom: 6, height: 12, width: `${line * 78}%`, borderRadius: 99, background: "#FFFFFF" }} />
          </span>
        </div>
      </AbsoluteFill>
      {brandIn > 0 && brandOut < 1 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 34, opacity: brandIn * (1 - brandOut), translate: `0px ${brandOut * -50}px`, filter: brandOut > 0 ? `blur(${brandOut * 12}px)` : undefined }}>
            <div style={{ width: 172, height: 172, borderRadius: 999, background: "white", display: "grid", placeItems: "center", boxShadow: "0 24px 60px rgba(120,30,30,0.28)", scale: String(0.5 + brandIn * 0.5), rotate: `${(1 - brandIn) * -30}deg` }}>
              <Img src={staticFile("img/suitespot-logo.svg")} style={{ width: 128, height: 128 }} />
            </div>
            <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: "-0.04em", color: "white", translate: `${(1 - brandIn) * -40}px 0px` }}>SuiteSpot</div>
          </div>
        </AbsoluteFill>
      ) : null}
      {/* end card */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - exit, scale: String(1 + ip(t, [54.05, 56.3], [0, 0.03], (v) => v) - exit * 0.04), filter: exit > 0 ? `blur(${exit * 8}px)` : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, translate: "0px -40px" }}>
          <Img src={staticFile("img/suitespot-logo.svg")} style={{ width: 120, height: 120, opacity: logoIn, scale: String(0.6 + logoIn * 0.4) }} />
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.035em", color: C.ink, opacity: nameIn, translate: `${(1 - nameIn) * -30}px 0px`, filter: nameIn < 1 ? `blur(${(1 - nameIn) * 10}px)` : undefined }}>SuiteSpot</div>
        </div>
        <div style={{ position: "absolute", top: 640, textAlign: "center", opacity: metaIn, translate: `0px ${(1 - metaIn) * 16}px` }}>
          <div style={{ fontSize: 30, fontWeight: 500, color: C.ink }}>suitespot-production.up.railway.app</div>
          <div style={{ fontSize: 19, fontWeight: 500, color: C.ink2, marginTop: 14 }}>Synthetic demo data · Not financial or legal advice</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
