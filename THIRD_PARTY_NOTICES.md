# Third-party notices

Grimoire is built on other people's work. This file lists what it includes and under which terms. It does not change those terms.

## Game content: SRD 5.1

The bundled game content comes from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, licensed under the Creative Commons Attribution 4.0 International License (CC-BY-4.0). The full attribution is in [NOTICE.md](NOTICE.md). No other Wizards of the Coast content and no other third-party game content is included in this repository or the app. How that is checked, and its limits, are in [docs/SRD_EDITION.md](docs/SRD_EDITION.md).

## Libraries

These are the direct runtime dependencies of the app (from `package.json`), with the version installed for the 0.1.0 alpha and the licence each declares. All are MIT, which is compatible with the GPL.

| Package | Version | License |
| --- | --- | --- |
| expo | 56.0.21 | MIT |
| expo-camera | 56.0.8 | MIT |
| expo-constants | 56.0.25 | MIT |
| expo-document-picker | 56.0.4 | MIT |
| expo-file-system | 56.0.11 | MIT |
| expo-image-picker | 56.0.25 | MIT |
| expo-keep-awake | 56.0.3 | MIT |
| expo-linking | 56.0.17 | MIT |
| expo-network | 56.0.5 | MIT |
| expo-print | 56.0.4 | MIT |
| expo-router | 56.2.20 | MIT |
| expo-secure-store | 56.0.4 | MIT |
| expo-sharing | 56.0.26 | MIT |
| expo-sqlite | 56.0.6 | MIT |
| expo-status-bar | 56.0.4 | MIT |
| react | 19.2.3 | MIT |
| react-dom | 19.2.3 | MIT |
| react-native | 0.85.3 | MIT |
| react-native-qrcode-svg | 6.3.21 | MIT |
| react-native-safe-area-context | 5.7.0 | MIT |
| react-native-screens | 4.26.2 | MIT |
| react-native-svg | 15.15.4 | MIT |
| react-native-tcp-socket | 6.4.1 | MIT |
| react-native-web | 0.21.2 | MIT |
| zustand | 5.0.14 | MIT |

Each of these packages also brings its own dependencies, which keep their own licences and are installed with `npm install`. Those indirect dependencies are not listed one by one here. To see them, run `npm ls` or read the `license` field of the packages in `node_modules`.

## What is not covered here

- Homebrew that people create or import is not part of this repository. It stays with whoever made it.
- The Grimoire name and logo are covered by [TRADEMARKS.md](TRADEMARKS.md), not by the GPL.
