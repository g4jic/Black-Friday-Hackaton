# Demo listings (SYNTHETIC DEMO DATA)

Eight invented listings for commercial spaces in Novi Sad, written as raw text the way real listings look (different
styles and levels of detail). They are **not real properties**. Street and neighbourhood names are public places;
the listings, prices and details are made up. No phone numbers, emails or agent names.

Demo mode feeds them to the Scout exactly like text a user pastes in mode A (same code path). The scripted model
answers the MockRunner replays are in `fixtures/mock-answers/scout.json`; plain code checks every quote in them
against these texts.

Planned demo profile (for the evaluators, later steps): a specialty cafe, 50 to 90 m2, monthly budget 1,500 EUR.

| File | Style | What it is for in the demo |
|---|---|---|
| demo-01 | agency, full details | the strong candidate: price, area, deposit, service charge all stated |
| demo-02 | short "premium" ad | **hard flag**: 3,200 EUR rent, far above the 1,500 EUR budget |
| demo-03 | private owner, lower case, one paragraph | **missing key data**: no area at all; deposit, floor, heating, parking missing |
| demo-04 | bullet list, former restaurant | **soft flag**: title says private parking, the features say shared parking (check before signing) |
| demo-05 | office building | soft flag material: price "+ PDV" (VAT on top), first floor, no shop window |
| demo-06 | ALL CAPS | needs renovation (fit-out cost) |
| demo-07 | bullet points | deposit "one month's rent" stays missing (the Scout never computes), service charge "included" |
| demo-08 | short | missing rent: "Cena na upit" (price on request) |
