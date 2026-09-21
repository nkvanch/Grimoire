# Grimoire

A table companion app for 5th-edition-compatible tabletop roleplaying games: character sheets, homebrew content authoring, `.grimoire-pack` sharing, and local LAN campaign sync between a DM and players. Built with [Expo](https://expo.dev) and React Native.

Everything stays on your own devices. Nothing is collected or sent to any server, and no account is needed. Campaign sync is direct device-to-device over your local network.

## What this repository is

This is the **official, SRD-only edition** of Grimoire. It contains the app code and only content that is safe to distribute: the System Reference Document 5.1 (CC-BY-4.0) and original data written for this project. It is meant to be the central place people build from, fork, and download releases of.

| Content | Count |
| --- | --- |
| Spells | 335 |
| Items | 695 |
| Monsters | 322 |
| Classes | 12, each with its one SRD subclass |
| Races | 9 (with their SRD subraces) |
| Backgrounds | 1 (Acolyte) |
| Feats | 1 (Grappler) |
| Conditions | 14 |

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

**Code** in this repository is licensed under the **GNU General Public License v3.0 or later**, see [LICENSE](LICENSE).

**Game content** taken from the System Reference Document 5.1 is licensed by Wizards of the Coast LLC under the **Creative Commons Attribution 4.0 International License (CC-BY-4.0)**, not the GPL. The required attribution is in [NOTICE.md](NOTICE.md) and in the app's "About & Legal" screen.

This project is not affiliated with, endorsed by, or sponsored by Wizards of the Coast. Dungeons & Dragons and its logo are trademarks of Wizards of the Coast LLC; their use here is purely descriptive.
