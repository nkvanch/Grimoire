# Changelog

One entry per build that testers can install. To see which build you have, open Android Settings, Apps, Grimoire.

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
