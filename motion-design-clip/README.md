# SuiteSpot intro video (Remotion)

A 54.75 second motion design intro (1920x1080, 60 fps) that presents SuiteSpot as a financial decision tool for a
business choosing a commercial lease. It has its own `package.json`; the app in the repo root does not depend on it.

## Run
```powershell
cd motion-design-clip
npm install
npm run dev                                   # Remotion Studio preview
npx remotion render SuiteSpotIntro out/suitespot-intro.mp4 --codec=h264 --crf=18
```
The audio files are not in git (`public/audio/`, generated with ElevenLabs). Without them the video renders silent
only after removing `<Sound />` in `src/Video.tsx`.

## Where the numbers come from
Every figure on screen is from the recorded **Office in Beograd** run, replayed with no key and saved in
`material/recorded-run/` (`events.txt`, `report.json`, `research.json`, `questionnaire.json`): the questionnaire (1,300 EUR
budget, 12,000 EUR expected revenue, 35-80 m2), the run (9.9 s, up to 30 agent tasks at once, 2 spaces ruled out),
the Lease reader's deal breaker on Voždovac 51 m2 at 3.95 s and the Finance analyst cut at 4.56 s
(`src/run-data.ts` is generated from `events.txt`), the ranking and the #1 candidate Palilula 45 m2 (840 EUR a month,
14,580 EUR initial cost, 33,160 EUR over 24 months, at least 2,500 EUR to leave after 12 months, payback 2 months,
lease 28,440 EUR vs buy 17,429 EUR over 3 years). The run is slowed down on screen between the deal breaker and the
cut so it can be seen; the Timeline shows the real times. All listings are synthetic.

## Structure
- `src/Video.tsx`: the scenes on one timeline; `src/Sound.tsx`: narration phrases, music ducking, effects.
- `src/scenes/`: 1 problem, 2 turn, 3 map, `AppWindow.tsx` (4 questionnaire, 5-6 run, Timeline, Report, 7 results and
  candidate page in one browser window with a camera), 8 deal, 9 end.
- `src/auth-buildings.ts` is copied from `web/src/pages/auth-buildings.ts`; the gradient, colours and font follow
  `DESIGN.md`.

## Credits
- [Remotion](https://www.remotion.dev) (free for teams of up to 3 people).
- Voice, music and sound effects generated with [ElevenLabs](https://elevenlabs.io) (voice "Brooklyn Narrator -
  Business & Tech").
- Hanken Grotesk (SIL Open Font License 1.1), icons from lucide (ISC).
