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
  [15.1, 12.54, 17.27],
  [21.25, 17.74, 18.75],
  [22.35, 18.97, 20.3],
  [24.55, 20.74, 22.62],
  [26.55, 22.84, 25.2],
  [32.35, 25.7, 27.75],
  [34.55, 27.99, 29.82],
  [36.85, 30.2, 31.43],
  [38.95, 31.8, 33.58],
  [40.85, 33.87, 35.48],
  [42.65, 35.96, 38.9],
  [45.85, 39.15, 40.3],
  [48.4, 40.75, 41.45],
  [49.3, 41.83, 43.2],
];

const SFX: [string, number, number][] = [
  // [file, time s, volume]
  ["whoosh", 3.92, 0.5],
  ["pop", 4.15, 0.55],
  ["whoosh", 6.05, 0.3],
  ["pop", 6.36, 0.5],
  ["pop", 7.56, 0.5],
  ["pop", 8.76, 0.5],
  ["whoosh", 10.05, 0.6],
  ["pop", 10.85, 0.45],
  ["riser", 11.05, 0.5],
  ["hit", 11.97, 0.45],
  ["pop", 12.93, 0.45],
  ["pop", 14.17, 0.5],
  ["whoosh", 14.45, 0.5],
  ["hit", 14.97, 0.4],
  ["tick", 16.05, 0.35],
  ["tick", 16.42, 0.35],
  ["tick", 17.25, 0.35],
  ["tick", 17.85, 0.35],
  ["tick", 18.15, 0.35],
  ["tick", 18.5, 0.35],
  ["whoosh", 19.75, 0.35],
  ["click", 20.22, 0.7],
  ["whoosh", 20.35, 0.45],
  ["pop", 21.5, 0.4],
  ["pop", 21.78, 0.4],
  ["pop", 22.06, 0.4],
  ["pop", 22.34, 0.4],
  ["riser", 23.6, 0.4],
  ["whoosh", 24.2, 0.35],
  ["hit", 25.1, 0.7],
  ["whoosh", 25.85, 0.5],
  ["stop", 27.4, 0.85],
  ["whoosh", 28.05, 0.4],
  ["whoosh", 29.55, 0.4],
  ["ping", 29.95, 0.5],
  ["stop", 30.5, 0.55],
  ["pop", 30.6, 0.45],
  ["whoosh", 32.2, 0.4],
  ["tick", 33.05, 0.45],
  ["tick", 33.55, 0.45],
  ["tick", 34.05, 0.45],
  ["tick", 34.55, 0.45],
  ["tick", 35.05, 0.45],
  ["pop", 34.85, 0.35],
  ["whoosh", 36.55, 0.4],
  ["pop", 36.8, 0.3],
  ["pop", 37.02, 0.3],
  ["pop", 37.24, 0.3],
  ["pop", 37.46, 0.3],
  ["pop", 37.68, 0.3],
  ["whoosh", 38.4, 0.4],
  ["pop", 41.0, 0.45],
  ["pop", 41.6, 0.45],
  ["click", 42.0, 0.7],
  ["whoosh", 42.3, 0.45],
  ["click", 43.05, 0.7],
  ["whoosh", 43.18, 0.35],
  ["ping", 44.05, 0.5],
  ["click", 45.2, 0.7],
  ["whoosh", 45.32, 0.35],
  ["ping", 46.05, 0.6],
  ["whoosh", 47.95, 0.55],
  ["pop", 48.38, 0.55],
  ["hit", 50.0, 0.6],
  ["whoosh", 51.45, 0.4],
  ["ping", 52.0, 0.45],
  ["whoosh", 54.2, 0.25],
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
          // about +2.5 dB over the first cut, still ducked under the voice
          const base = speaking(t) ? 0.21 : 0.56;
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
