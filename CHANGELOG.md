# Changelog

One entry per build that testers can install. To see which build you have, open Android Settings, Apps, Grimoire.

## 0.2.1 alpha

Released 9 October 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.1-alpha).

APK SHA-256: `536e281fbc17dfc83f9771ac575742f1ea86588ff9f0c0d3dbd42b9759f44c0d`

Same signing key as 0.2.0, so it installs over 0.2.0 as a normal update and keeps your characters.

### New

- Homebrew can now widen a class's spell list for one character (for example a patron's expanded spells). The spell pickers on the sheet and in character creation both offer those spells.
- Homebrew can change the damage type and the die a spell shows on its card (a cantrip that deals fire damage on a d12 instead of its printed type and die).
- A new armor condition for homebrew effects: "while not wearing medium or heavy armor".

### Fixed

- The character creation Spells screen ignored a feature's expanded spell list. It now offers those spells.

## 0.2.0 alpha

Released 8 October 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.0-alpha).

APK SHA-256: `f9d8f6a7a13da914594a536d675c1eb211d809e3549b4281ec530e82aea06dd5`

**The signing key changed.** 0.1.0 was signed with a key whose password was lost, so 0.2.0 is signed with a new Grimoire release key (certificate SHA-256 `d312ce98e33214db755b61fe7057fde567d0d29b856d396ee00b432cd053c27e`). Android will not install it over 0.1.0: export your characters from 0.1.0, uninstall it, install 0.2.0, then import them. Future updates will use the new key.

### New

- Both rulesets: characters follow the 2014 rules (SRD 5.1) or the 2024 rules (SRD 5.2.1). The 2024 side has all twelve classes with their SRD subclass, the nine species, the four SRD backgrounds, the SRD feats, Weapon Mastery, the 2024 equipment and magic items, and the 2024 spell list changes.
- Content now ships as two signed packs (SRD 5.1 and SRD 5.2.1) installed on first launch, instead of being compiled into the app.
- Campaigns: a Close Campaign / Switch button so you can leave a campaign and start or open another, and hosting only starts when you choose it.
- Campaign sync: the DM's private campaign notes are not sent to players.
- Live play: conditions can have a duration, and players get an End Turn control.
- Undo and redo for sheet changes, with a timeline of what changed.
- Previews before you commit: short and long rest, feat changes, equipment changes and level-up show what will change first.
- A progression planner that projects a single-class character's future levels.
- A test bench in the homebrew builders that runs a build through the same rules engine as a real character.
- Warlock pact slots recharge on a short rest in the 2024 rules.

### Fixed

- The Android navigation bar no longer covers buttons at the bottom of the encounter screens.
- Ammunition and ammunition cases no longer appear as weapons in the item browser.
- Background ability score increases of +1/+1/+1 select their chips automatically.
- Class names on sheets and the DM character view now follow the character's ruleset.

### Content

- This build contains only SRD 5.1 and SRD 5.2.1 (both CC-BY-4.0) and original content. Content from other books is not included in the app or the repository. See [docs/SRD_EDITION.md](docs/SRD_EDITION.md).

### Known limits

- Android only.
- Campaign sync is not encrypted and has no password. See [docs/ALPHA_LIMITATIONS.md](docs/ALPHA_LIMITATIONS.md).

## 0.1.0 alpha

The first alpha for testers, released 21 September 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.1.0-alpha).

APK SHA-256: `9a29897c76f899332e1afc0fbd326665229ad4b9a769df5691e7a90e46d4f62a`

### In this build

- Character creation, level-up and a full character sheet.
- Homebrew builders for races, subraces, classes, subclasses, spells, items, monsters, feats, backgrounds and conditions, with a Test button in most of them.
- The Compendium in three modes: Official (bundled SRD content only), Homebrew (your library) and Packages (installed packs).
- Export Homebrew for one entry and everything it needs, and a multi-select Package Builder for several entries. Anything a package depends on is included automatically and shown on a review screen.
- Importing a `.grimoire-pack` with a preview first, grouped by type, added all together or not at all.
- Export Character and Import Character as Grimoire Character JSON, with PDF, Markdown and text copies for reading.
- Custom Rule Profiles, and point buy with a configurable budget.
- Optional campaign sync over the local network, with a room code or QR code.
- Only the permissions the app needs: camera (to scan a campaign QR code), local network and internet access for sync, storage access on older Android for import and export, and vibration. Microphone, biometrics and draw-over-apps are not requested.

### Content

- This build contains only SRD 5.1 (CC-BY-4.0) and original content. Content from other books is not included in the app or the repository.

### Known limits

- Android only.
- Reactive features and outcomes are shown as text and are not resolved automatically.
- A character file does not include the homebrew it uses.
- Campaign sync is not encrypted and has no password.
