// Renders check frames: node scripts/stills.mjs 12.5 13.2 ... (seconds). Writes out/frames/t<sec>.png at half size.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const times = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "SuiteSpotIntro" });
for (const t of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * 60));
  await renderStill({ composition, serveUrl, frame, output: `out/frames/t${t}.png`, scale: 0.5 });
  process.stdout.write(`${t} `);
}
