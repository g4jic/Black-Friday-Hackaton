import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, fontFamily, ip, s, easeIn, easeInOut } from "../lib";
import { Lens, Words } from "../ui";

/**
 * Scene 2 (starts at 10.1 s, local frames): the rent pill floods the frame in brand coral, "Find your SuiteSpot."
 * arrives word by word, the lens flies in, then the camera enters the lens: its white glass fills the frame.
 */
export const S2Turn: React.FC = () => {
  const f = useCurrentFrame();
  const flood = ip(f, [0, s(0.42)], [0, 1], easeInOut);
  const lensIn = ip(f, [s(0.75), s(1.2)], [0, 1]);
  const enter = ip(f, [s(1.45), s(1.95)], [0, 1], easeIn);
  const textOut = ip(f, [s(1.4), s(1.7)], [0, 1], easeIn);
  // lens position: from off right to the right of the text, then to centre while it grows
  const lx = ip(f, [s(0.75), s(1.2)], [1300, 520]) * (1 - ip(f, [s(1.4), s(1.72)], [0, 1]));
  const lensSize = 300 * (1 + enter * 18);
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill style={{ background: C.brand, clipPath: `circle(${flood * 1250}px at 50% 50%)` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            translate: `${-170 - textOut * 80}px 0px`,
            opacity: 1 - textOut,
            filter: `blur(${textOut * 12}px)`,
            fontSize: 118,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: C.ink,
          }}
        >
          <Words text="Find your SuiteSpot." at={s(0.42)} step={7} accent={["SuiteSpot"]} accentColor="#FFFFFF" />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            translate: `${lx}px ${ip(f, [s(0.75), s(1.2)], [-60, 0])}px`,
            rotate: `${ip(f, [s(0.75), s(1.2)], [35, 0])}deg`,
            opacity: lensIn,
            filter: `blur(${(1 - ip(f, [s(0.75), s(1.1)], [0, 1])) * 14}px)`,
            width: 300,
            height: 300,
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* scaled so the glass centre (212/480 of the box) stays on the frame centre while entering */}
          <div style={{ scale: String(lensSize / 300), transformOrigin: `${(212 / 480) * 100}% ${(212 / 480) * 100}%` }}>
            <Lens size={300} building={0} style={{ filter: "drop-shadow(0 30px 50px rgba(120,30,30,0.35))" }} />
          </div>
        </div>
      </AbsoluteFill>
      {/* the glass fills the frame: plain white bridge into the map */}
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: ip(f, [s(1.82), s(1.95)], [0, 1]) }} />
    </AbsoluteFill>
  );
};
