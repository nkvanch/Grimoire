# The SRD edition

This repository is derived from a fuller private build of Grimoire. It contains only content that is either part of the System Reference Document 5.1 (CC-BY-4.0) or original to this project.

## Rule

An entry ships here only if its `srd` flag is explicitly `true`. Entries with `srd: false`, and entries with no flag at all, are not in this repository. When in doubt an entry is left out, since leaving one out costs a little content and leaving one in costs a licence problem.

Types with no `srd` field are handled as follows.

| Type | Decision |
| --- | --- |
| Conditions | Kept. They are the SRD condition list. |
| Beast forms | Kept. Each is an SRD monster used for Wild Shape. |
| Infusions | Not shipped. The list is empty. |
| Companions | Not shipped. The list is empty. |
| Built-in homebrew | None. A fresh install has no seeded homebrew. |

## What was removed and how it is checked

The non-SRD entries were removed from the source files (not just hidden at runtime), together with everything that only existed for them: their subclass, race and feat definitions, helper functions, class slot tables, class option lists, and comments naming them. `assets/content.db` is regenerated from the remaining source with `scripts/generate-content-db.mjs`.

Checks that pass on this tree:

- The catalog of every content type equals the SRD keep-list exactly, with nothing extra and nothing missing. Subraces are checked one by one.
- `assets/content.db` contains none of the removed names.
- Type-check and the full Jest suite pass. Tests that asserted removed content were removed with it.

## Limits

- The `srd` flags come from the project's own audit against SRD 5.1. This edition trusts them. It has not been independently reviewed by a lawyer.
- Descriptions and option lists that live inside a kept entry (for example the feature text of an SRD class) are as they were authored. They were not re-audited line by line against the SRD.
- Homebrew you create or import in the app is yours. It is stored on your device and never bundled.
