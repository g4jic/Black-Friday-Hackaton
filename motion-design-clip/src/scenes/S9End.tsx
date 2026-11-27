import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C, fontFamily, ip, easeInOut } from "../lib";
import { Words } from "../ui";

/**
 * Scene 9 (50.05 s to the end): the Paid check floods the frame in brand coral, "Know before you sign.", then the
 * coral contracts into a small circle that becomes the logo's lens ring; small logo, name, address, notice.
 */
export const END_FROM = 50.05;

export const S9End: React.FC = () => {
  const f = useCurrentFrame();
  const t = END_FROM + f / 60;
  const flood = ip(t, [50.05, 50.5], [0, 1], easeInOut);
  const shrink = ip(t, [53.55, 54.15], [0, 1], easeInOut);
  const r = flood * 1300 * (1 - shrink) + shrink * 40;
  const coralOn = t < 54.25;
  const textOut = ip(t, [53.4, 53.6], [0, 1]);
  const logoIn = ip(t, [54.05, 54.45], [0, 1]);
  const nameIn = ip(t, [54.3, 54.75], [0, 1]);
  const metaIn = ip(t, [54.7, 55.1], [0, 1]);
  // the circle ends where the logo's lens centre sits
  const cx = 960 + shrink * -230;
  const cy = 540 + shrink * -47;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      {coralOn ? <AbsoluteFill style={{ background: C.brand, clipPath: `circle(${r}px at ${cx}px ${cy}px)` }} /> : null}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 136, fontWeight: 700, letterSpacing: "-0.04em", color: C.ink, opacity: 1 - textOut, filter: `blur(${textOut * 14}px)`, scale: String(1 - textOut * 0.06) }}>
          <Words text="Know before you sign." at={Math.round((51.35 - END_FROM) * 60)} step={9} rise={40} accent={["sign"]} accentColor="#FFFFFF" />
        </div>
      </AbsoluteFill>
      {/* end card */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, translate: "0px -40px" }}>
          <Img src={staticFile("img/suitespot-logo.svg")} style={{ width: 120, height: 120, opacity: logoIn, scale: String(0.6 + logoIn * 0.4) }} />
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.035em", color: C.ink, opacity: nameIn, translate: `${(1 - nameIn) * -30}px 0px`, filter: `blur(${(1 - nameIn) * 10}px)` }}>SuiteSpot</div>
        </div>
        <div style={{ position: "absolute", top: 640, textAlign: "center", opacity: metaIn, translate: `0px ${(1 - metaIn) * 16}px` }}>
          <div style={{ fontSize: 30, fontWeight: 500, color: C.ink }}>suitespot-production.up.railway.app</div>
          <div style={{ fontSize: 19, fontWeight: 500, color: C.ink2, marginTop: 14 }}>Synthetic demo data · Not financial or legal advice</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
