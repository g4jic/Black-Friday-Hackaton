import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

/**
 * The sound track. Narration (ElevenLabs, take A) is cut at its pauses and each phrase is placed on the beat it
 * belongs to: [video start s, source start s, source end s]. Music ducks under the voice. Effects sit on the motion.
 */
export const NARRATION: [number, number, number][] = [
  [0.3, 0.0, 3.7],
  [4.2, 4.04, 5.95],
  [6.38, 6.46, 7.4],
  [7.58, 7.69, 8.7],
  [8.78, 9.01, 10.33],
  [10.55, 10.99, 12.11],
  [15.5, 12.54, 17.27],
  [21.75, 17.74, 18.75],
  [22.85, 18.97, 20.3],
  [25.05, 20.74, 22.62],
  [27.05, 22.84, 25.2],
  [31.0, 25.7, 27.75],
  [33.2, 27.99, 29.82],
  [35.55, 30.2, 31.43],
  [37.0, 31.8, 33.58],
  [38.95, 33.87, 35.48],
  [44.75, 35.96, 38.9],
  [47.95, 39.15, 40.3],
  [50.5, 40.75, 41.45],
  [51.4, 41.83, 43.2],
];

const SFX: [string, number, number][] = [
  // [file, time s, volume]
  ["whoosh", 3.92, 0.5],
  ["pop", 4.15, 0.55],
  ["pop", 6.36, 0.5],
  ["pop", 7.56, 0.5],
  ["pop", 8.76, 0.5],
  ["whoosh", 10.05, 0.6],
  ["whoosh", 10.82, 0.45],
  ["riser", 11.05, 0.5],
  ["hit", 11.97, 0.45],
  ["pop", 12.93, 0.45],
  ["pop", 14.17, 0.5],
  ["whoosh", 15.4, 0.45],
  ["tick", 16.55, 0.35],
  ["tick", 16.95, 0.35],
  ["tick", 17.85, 0.35],
  ["tick", 18.35, 0.35],
  ["tick", 18.75, 0.35],
  ["tick", 19.15, 0.35],
  ["click", 20.7, 0.7],
  ["whoosh", 20.85, 0.45],
  ["pop", 22.0, 0.4],
  ["pop", 22.28, 0.4],
  ["pop", 22.56, 0.4],
  ["pop", 22.84, 0.4],
  ["riser", 24.6, 0.4],
  ["hit", 25.6, 0.7],
  ["whoosh", 26.35, 0.5],
  ["stop", 27.9, 0.85],
  ["whoosh", 28.6, 0.4],
  ["ping", 30.3, 0.4],
  ["tick", 31.75, 0.45],
  ["tick", 32.25, 0.45],
  ["tick", 32.75, 0.45],
  ["tick", 33.25, 0.45],
  ["tick", 33.75, 0.45],
  ["whoosh", 35.3, 0.4],
  ["pop", 36.75, 0.4],
  ["whoosh", 37.35, 0.4],
  ["pop", 39.05, 0.4],
  ["pop", 39.85, 0.4],
  ["whoosh", 44.4, 0.45],
  ["click", 45.15, 0.7],
  ["pop", 45.3, 0.4],
  ["ping", 46.15, 0.5],
  ["click", 47.3, 0.7],
  ["ping", 48.15, 0.6],
  ["whoosh", 50.05, 0.55],
  ["hit", 51.35, 0.5],
  ["whoosh", 53.55, 0.4],
  ["ping", 54.1, 0.45],
];

const speaking = (t: number) => NARRATION.some(([v, a, b]) => t >= v - 0.25 && t <= v + (b - a) + 0.25);

export const Sound: React.FC<{ total: number }> = ({ total }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio
        src={staticFile("audio/music.mp3")}
        volume={(f) => {
          const t = f / fps;
          const base = speaking(t) ? 0.16 : 0.42;
          const fadeIn = Math.min(1, t / 0.4);
          const fadeOut = Math.min(1, Math.max(0, (total / fps - t) / 2.5));
          return base * fadeIn * fadeOut;
        }}
      />
      {NARRATION.map(([v, a, b], i) => (
        <Sequence key={`n${i}`} from={Math.round(v * fps)} durationInFrames={Math.round((b - a) * fps) + 2} name={`Narration ${i + 1}`}>
          <Audio src={staticFile("audio/narration-a.mp3")} trimBefore={Math.round(a * fps)} trimAfter={Math.round(b * fps)} volume={1} />
        </Sequence>
      ))}
      {SFX.map(([file, t, vol], i) => (
        <Sequence key={`s${i}`} from={Math.round(t * fps)} durationInFrames={Math.round(2.5 * fps)} name={`${file} ${t}s`}>
          <Audio src={staticFile(`audio/${file}.mp3`)} volume={vol} />
        </Sequence>
      ))}
    </>
  );
};
