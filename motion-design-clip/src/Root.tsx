import React from "react";
import { Composition } from "remotion";
import { SuiteSpotIntro, TOTAL } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="SuiteSpotIntro" component={SuiteSpotIntro} durationInFrames={TOTAL} fps={60} width={1920} height={1080} />
);
