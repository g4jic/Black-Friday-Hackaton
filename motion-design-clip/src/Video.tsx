import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { s } from "./lib";
import { Background } from "./ui";
import { S1Problem } from "./scenes/S1Problem";
import { S2Turn } from "./scenes/S2Turn";
import { S3Map } from "./scenes/S3Map";
import { AppWindow, APP_FROM, APP_TO } from "./scenes/AppWindow";
import { S8Deal } from "./scenes/S8Deal";
import { S9End } from "./scenes/S9End";
import { Sound } from "./Sound";

export const TOTAL = s(54.75);
const DEAL_AT = 42.3; // scene 8 (its own clock starts at 44.4 s)
const END_AT = 47.95; // scene 9 (its own clock starts at 50.05 s)

export const SuiteSpotIntro: React.FC = () => (
  <AbsoluteFill style={{ background: "#F7C3C0" }}>
    <Background />
    <Sequence from={0} durationInFrames={s(10.35)} name="1 Problem">
      <S1Problem />
    </Sequence>
    <Sequence from={s(10.1)} durationInFrames={s(1.95)} name="2 Turn">
      <S2Turn />
    </Sequence>
    <Sequence from={s(11.95)} durationInFrames={s(APP_FROM) - s(11.95)} name="3 Map">
      <S3Map />
    </Sequence>
    <Sequence from={s(APP_FROM)} durationInFrames={s(APP_TO) - s(APP_FROM)} name="4-7 App">
      <AppWindow />
    </Sequence>
    <Sequence from={s(DEAL_AT)} durationInFrames={s(6.0)} name="8 Deal">
      <S8Deal />
    </Sequence>
    <Sequence from={s(END_AT)} durationInFrames={TOTAL - s(END_AT)} name="9 End">
      <S9End />
    </Sequence>
    <Sound total={TOTAL} />
  </AbsoluteFill>
);
