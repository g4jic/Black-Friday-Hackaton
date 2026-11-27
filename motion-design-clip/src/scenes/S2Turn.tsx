import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, fontFamily, ip, s, easeIn, easeInOut } from "../lib";
import { Lens, Words } from "../ui";

/**
 * Scene 2 (starts at 10.1 s, local frames): the rent pill floods the frame in brand coral, "Find your SuiteSpot."
 * arrives word by word with the lens beside it (the row is centred in the frame and the lens grows in place, so it
 * never leaves the frame), then the lens moves to the centre and the camera enters it: its white glass fills the frame.
 */
const TEXT_X = -165; // centre of the text, from the frame centre
const LENS_X = 525; // centre of the lens box, from the frame centre (row 290..1630 px: equal margins)

export const S2Turn: React.FC = () => {
  const f = useCurrentFrame();
  const flood = ip(f, [0, s(0.42)], [0, 1], easeInOut);
  const lensIn = ip(f, [s(0.7), s(1.1)], [0, 1]);
  const enter = ip(f, [s(1.45), s(1.95)], [0, 1], easeIn);
  const textOut = ip(f, [s(1.28), s(1.48)], [0, 1], easeInOut); // gone before the lens slides over it
  const toCentre = ip(f, [s(1.38), s(1.72)], [0, 1], easeInOut);
  const lx = LENS_X * (1 - toCentre);
  const lensSize = 300 * (1 + enter * 18);
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill style={{ background: C.brand, clipPath: `circle(${flood * 1250}px at 50% 50%)` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            translate: `${TEXT_X - textOut * 80}px 0px`,
            opacity: 1 - textOut,
            filter: textOut > 0 ? `blur(${textOut * 12}px)` : undefined,
            fontSize: 118,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: C.ink,
            whiteSpace: "nowrap",
          }}
        >
          <Words text="Find your SuiteSpot." at={s(0.42)} step={7} accent={["SuiteSpot"]} accentColor="#FFFFFF" />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            translate: `${lx}px 0px`,
            rotate: `${(1 - lensIn) * -30}deg`,
            scale: String(0.4 + lensIn * 0.6),
            opacity: lensIn,
            filter: lensIn < 1 ? `blur(${(1 - lensIn) * 14}px)` : undefined,
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
