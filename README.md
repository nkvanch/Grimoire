# Grimoire

A table companion app for 5th-edition-compatible tabletop roleplaying games: character sheets, homebrew content authoring, `.grimoire-pack` sharing, and local LAN campaign sync between a DM and players. Built with [Expo](https://expo.dev) and React Native.

Everything stays on your own devices. Nothing is collected or sent to any server, and no account is needed. Campaign sync is direct device-to-device over your local network.

Website: https://nkvanch.github.io/Grimoire/ (documentation, changelog, privacy, feedback). Feedback: feedback.grimoire@gmail.com or a GitHub issue.

## Download

**Android alpha:** [Download Grimoire-alpha-0.2.1.apk](https://github.com/nkvanch/Grimoire/releases/download/v0.2.1-alpha/Grimoire-alpha-0.2.1.apk) (about 60 MB), or open the [latest release](https://github.com/nkvanch/Grimoire/releases/latest) for the checksum, the sample packs and what changed. Install steps are in the [documentation](https://nkvanch.github.io/Grimoire/documentation.html#install). It is a sideloaded alpha, not on the Play Store.

Coming from 0.1.0? It was signed with a different key, so export your characters, uninstall it, then install this one. From 0.2.0 it is a normal update.

## What this repository is

This is the **official, SRD-only edition** of Grimoire. It contains the app code and only content that is safe to distribute: the System Reference Document 5.1 and the System Reference Document 5.2.1 (both CC-BY-4.0) and original data written for this project. Characters can follow either the 2014 rules (SRD 5.1) or the 2024 rules (SRD 5.2.1, often called 5.5e). It is meant to be the central place people build from, fork, and download releases of.

The content ships as two signed packs, `assets/packs/grimoire.srd.5.1.json` and `assets/packs/grimoire.srd.5.2.1.json`, which the app installs on first launch.

| Content | SRD 5.1 pack (2014 rules) | SRD 5.2.1 pack (2024 rules) |
| --- | --- | --- |
| Spells | 319 | 339 |
| Items | 95 | 427 (gear, equipment and magic items) |
| Monsters | 322 | uses the SRD 5.1 stat blocks |
| Classes | 12, each with its one SRD subclass | 12, each with its one SRD subclass |
| Species / races | 9 (with their SRD subraces) | 9 |
| Backgrounds | 1 (Acolyte) | 4 |
| Feats | 1 (Grappler) | 19 |
| Conditions | 14 | 14 |
| Rules tables | Wild Shape beast forms | Weapon Mastery, class spell lists, beast forms, reference |

Anything else you play with lives in the app as **homebrew**: you create it, or import it from a `.grimoire-pack` file someone sent you. Homebrew is never bundled here.

See [docs/SRD_EDITION.md](docs/SRD_EDITION.md) for exactly how this edition is defined and checked.

## Getting started

```bash
npm install
npx expo start
```

See [Expo's documentation](https://docs.expo.dev/) for running on a device, simulator, or the web. Android is the supported platform for now.

Useful commands:

```bash
npm test          # Jest
npm run typecheck # tsc --noEmit
npm run lint      # ESLint
npx tsx scripts/generate-content-db.mjs   # rebuild assets/content.db from src/content
```

## License

Grimoire's application source code is licensed under the **GNU General Public License v3.0 or later**, see [LICENSE](LICENSE). You are free to use, study, modify and redistribute it. Distributed modified versions must keep the same freedoms and provide the corresponding source under the GPL.

The GPL covers the code only. Other parts have their own terms:

- **Documentation** (the website, this README, the changelog): CC BY-SA 4.0.
- **SRD 5.1 and SRD 5.2.1 game content**: licensed by Wizards of the Coast LLC under CC-BY-4.0, not the GPL. The attribution is in [NOTICE.md](NOTICE.md) and in the app's "About & Legal" screen.
- **Libraries**: their own licences, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **Homebrew** that you create or import stays yours and is not part of this repository.
- **Other Wizards of the Coast or third-party content** is not included.

The Grimoire name, logo and official branding are not licensed under the GPL, see [TRADEMARKS.md](TRADEMARKS.md). A modified version may say it is based on Grimoire, but should not present itself as an official Grimoire release or use the official branding without permission.

Grimoire is free to download and use.

This project is not affiliated with, endorsed by, or sponsored by Wizards of the Coast. Dungeons & Dragons and its logo are trademarks of Wizards of the Coast LLC; their use here is purely descriptive.
