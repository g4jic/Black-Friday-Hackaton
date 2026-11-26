# SuiteSpot

Mozaik agents check, in parallel, whether a commercial lease is a good financial decision for a small business.
Every number points to its source. Not financial or legal advice.

> Work in progress for the JigJoy Black Friday AI Hackathon (26-27 Nov 2026). The full README (quick start,
> architecture, how the agents run concurrently) is written at the end of the event.

## Known limitations
- **Agents' names in pasted listing text are not removed automatically.** Code removes phone numbers and emails from
  every pasted listing before anything is stored or sent to a model, but it cannot reliably detect a person's name.
  The Scout never extracts names (its output schema has no field for them, and its instruction forbids them), so a
  name can only remain inside the cleaned listing text itself. Do not paste listings with private details you do not
  want processed.
- SuiteSpot does not read listing sites automatically (we read their terms of use). Real listings come only from text
  the user pastes (1 to 8 per run); demo mode uses synthetic listings labelled "Demo data".
