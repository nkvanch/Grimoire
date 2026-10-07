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
- Type-check and the full Jest suite pass. Tests that asserted removed content were removed with it.

## Limits

- The packs come from the project's own audit against SRD 5.1 and SRD 5.2.1. This edition trusts them. It has not been independently reviewed by a lawyer.
- Descriptions and option lists that live inside a kept entry (for example the feature text of an SRD class) are as they were authored. They were not re-audited line by line against the SRD.
- Homebrew you create or import in the app is yours. It is stored on your device and never bundled.
