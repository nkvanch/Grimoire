# The SRD edition

This repository is derived from a fuller private build of Grimoire. It contains only content that is part of the System Reference Document 5.1 or the System Reference Document 5.2.1 (both CC-BY-4.0), or original to this project.

## Rule

The content that ships is exactly what the two signed packs carry: `assets/packs/grimoire.srd.5.1.json` and `assets/packs/grimoire.srd.5.2.1.json`. A catalog entry is in this repository only if one of those packs carries it. When in doubt an entry is left out, since leaving one out costs a little content and leaving one in costs a licence problem.

| Type | Decision |
| --- | --- |
| Conditions | Kept. They are the SRD condition list. |
| Beast forms | Kept. Each is an SRD monster used for Wild Shape. |
| Infusions | Not shipped. The list is empty. |
| Companions | Not shipped. The list is empty. |
| Built-in homebrew | None. A fresh install has no seeded homebrew. |

Items are the narrowest part. The SRD 5.1 pack carries only items verified against the SRD 5.1 text. The SRD 5.2.1 pack carries the 2024 gear, equipment and magic items. A few 5e catalog items stay in the source because a 2024 magic item takes its mechanics from the record with the same id.

## What was removed and how it is checked

Entries that no shipped pack carries were removed from the source files (not just hidden at runtime), together with everything that only existed for them: their subclass, race and feat definitions, helper functions, class slot tables, class option lists, tests, and comments naming them.

Checks that pass on this tree:

- Both packs rebuild from the source in this repository with the same content hash as the packs the app ships.
- A scan of the tree for the names and ids of removed content finds none.
- The text is checked, not only the ids (`src/content/__tests__/srdTextProvenance.test.ts`, against the text of the two SRD PDFs in `third_party/wotc/srd`):
  - every spell in each pack has an entry of that name in its SRD and is worded substantially as that SRD words it;
  - every spell record in the source is an SRD 5.1 spell or carries its SRD 5.2.1 wording exactly;
  - the background personality tables are SRD 5.1 text word for word, and no source file names a 2014 background feature that is not in SRD 5.1;
  - no spell text links to another site, apart from the records listed below.
- Type-check and the full Jest suite pass. Tests that asserted removed content were removed with it.

### Corrected after the first release

- Fifteen spells that are only in SRD 5.2.1 (Chromatic Orb, Dissonant Whispers, Ensnaring Strike, Hex, Ice Knife, Ray of Sickness, Searing Smite, Dragon's Breath, Mind Spike, Phantasmal Force, Aura of Life, Charm Monster, Vitriolic Sphere, Tsunami, Power Word Heal) had their 2014 wording, from other books, in the source records. The id check passed them because the same ids exist in SRD 5.2.1. The records now carry the SRD 5.2.1 wording. The packs did not change: they only read those records' ids and classes, and their 2024 text already came from SRD 5.2.1.
- The creation screen held the feature names and personality tables of the twelve 2014 backgrounds that are not in SRD 5.1. They are removed. The Acolyte's tables are the SRD 5.1 text in full, as data (`src/content/backgrounds/characteristics.ts`), and homebrew backgrounds can carry their own.
- Eighteen SRD 5.1 spell records in the signed 5.1 pack still carry links to the third-party site their text was collected from (Arcane Lock, Astral Projection, Awaken, Clairvoyance, Contact Other Plane, Contagion, Find Steed, Find Traps, Gentle Repose, Giant Insect, Imprisonment, Knock, Locate Creature, Modify Memory, Arcanist's Magic Aura, Resilient Sphere, Phantom Steed, Speak with Plants). The app shows their text without the links. Removing them from the file needs the pack to be rebuilt and re-signed with the project's key.

## Limits

- The packs come from the project's own audit against SRD 5.1 and SRD 5.2.1. This edition trusts them. It has not been independently reviewed by a lawyer.
- Descriptions and option lists that live inside a kept entry (for example the feature text of an SRD class) are as they were authored. They were not re-audited line by line against the SRD.
- Homebrew you create or import in the app is yours. It is stored on your device and never bundled.
