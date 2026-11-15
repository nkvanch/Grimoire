# Changelog

One entry per build that testers can install. To see which build you have, open Android Settings, Apps, Grimoire.

## 0.2.6 alpha

Released 15 November 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.6-alpha).

Same signing key as 0.2.5, so it installs over 0.2.0 to 0.2.5 as a normal update and keeps your characters.

### Fixed

- Equipped armor sets your Armor Class from the armor itself, for example Plate Armor gives 18, also for armor whose data had no AC rule of its own. A shield adds 2, and a magic bonus stated in the name or text is added.
- Screen readers name each Use button after its card, and the label no longer stays on "Overrule" after the card is available again.

## 0.2.5 alpha

Released 15 November 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.5-alpha).

APK SHA-256: 149f1a76e718f9b16dbb6fa9bb14aeda6de3f6b867db5c106e2d1e69441662ef

Same signing key as 0.2.4, so it installs over 0.2.0 to 0.2.4 as a normal update and keeps your characters.

### New

- Tap an action card or a resource to see its full description. Tapping never uses it.
- Cleric, Druid and Paladin prepare spells from their class list on the Spells tab, which shows how many are prepared and asks before going past the limit (a warning, not a rule).
- Remove a spell from a character after creation.
- An updated app brings fixes to its SRD packs to devices that installed them with an earlier version. Your characters, homebrew and imported packs are left as they are.

### Fixed

- A weapon attack used from its card is one attack of the Attack action, so Extra Attack works from any attack card instead of asking to overrule the second attack.
- Action Surge gives an additional action.
- Renaming an item renames its own feature too, so its mode switch and other labels follow, including items renamed before.

## 0.2.4 alpha

Released 15 November 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.4-alpha).

APK SHA-256: f657c44bd4a7c08b9064488d6184fa3579e302c38f0266256746ac972ec41252

Same signing key as 0.2.3, so it installs over 0.2.0 to 0.2.3 as a normal update and keeps your characters.

### New

- A PDF character sheet, two pages, in three looks: Illuminated, Astrolabe and Ledger.
- A character info page on the sheet, a portrait for each character, and renaming a character after creation.
- Setting an ability score by its total, and customising an item you own (its name, description, uses and what it does to ability scores). An official item becomes your own homebrew copy.
- Modes: a feature or an item can switch between ways it works, chosen on the sheet.
- Pictures for homebrew content, an icon and a large picture, shown in the Compendium and your library. Big photos are shrunk to fit.
- Builders can ask the player for skills, an ability improvement or feat, spells, or a pick from a feature pool, and a class can say what it grants when taken as a second class.
- Multiclassing checks the ability scores each class needs, with Overrule for tables that allow it. Overrule also lets you use a card with no slot left, a spent resource or an action already used, and go past the attunement limit.
- House rules apply: feats can be switched off, and failed death saves can carry over until a long rest.
- The Compendium shows each entry's details: a class or subclass lists its features by level, an item its cost, weight, properties and features. Each row says which edition it is from.
- Leaving a builder or closing an editing pop-up with unsaved changes asks before discarding them.
- About & Legal shows the app version.
- Live sessions between devices are encrypted, and each device remembers the room it joined so another device cannot pretend to be it later. The app still says to use live play only on networks you trust.

### Fixed

- Maximum hit points now follow Constitution whatever changes it, an item, a mode, a feature or a condition, not only improvements and feats. Characters saved before are put right when they load.
- An item that sets an ability score, like a Belt of Giant Strength, gives exactly that score.
- The Defense fighting style reads the armor you wear instead of asking, and Archery and Dueling now count on your weapon attacks.
- Critical Hit is offered only on attack rolls, not on healing or saving throw spells.
- Buttons and text boxes are named for screen readers.
- Pop-ups no longer put their buttons under the Android navigation bar.
- Name boxes no longer autocorrect invented names.
- Character creation: starting hit points are right, SRD casters get their spell choices, and the Skills step says where an already trained skill came from.
- A skill check uses the same ability scores as the passive scores, overrides included.
- Healing no longer clears failed death saves when that house rule is on.
- On narrow phones the sheet's controls wrap instead of running off the screen.

## 0.2.3 alpha

Released 12 October 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.3-alpha).

APK SHA-256: b332fd370298d35bfc1f276fd3930767b200aa8407f99b58417802fc4e8a289a

Same signing key as 0.2.2, so it installs over 0.2.0, 0.2.1 or 0.2.2 as a normal update and keeps your characters.

### New

- Homebrew: a feature can be a card with nothing to track, usable as an action, bonus action or reaction without limit, like Cunning Action.
- Homebrew: a feature can spend a resource that already exists, such as a class's Ki or Wild Shape, or a pool another feature of the same class made, instead of creating a pool of its own.
- Homebrew: a pool's maximum can follow the proficiency bonus, an ability modifier or character level, and a class or subclass feature can raise a pool at its own level (4 dice, then 5 at 7th level, then 6 at 15th).
- Homebrew: every builder has an optional Source, a name and a link, for content that did not start in Grimoire. It is kept with the content, travels in packs and shows in the Library.

### Fixed

- A fresh install of 0.2.2 could not install the bundled SRD packs ("not signed by a key this app trusts"). They are signed now and install on first run.
- The feat builder's help text named two feats that are not in the SRD. It is generic now.

## 0.2.2 alpha

Released 11 October 2026. [Download it from GitHub Releases](https://github.com/nkvanch/Grimoire/releases/tag/v0.2.2-alpha).

APK SHA-256: 6d5827a1aaab2e3f08d17f7caab484507ab5b291e7248dd260d319483abedc80

Same signing key as 0.2.1, so it installs over 0.2.1 as a normal update and keeps your characters.

### New

- Wild Shape for the 2014 Druid is one card with a picker. It lists every SRD beast your Druid level allows, with its real walking, swimming, flying and climbing speeds, and the form's own attacks show as cards while you are shaped.
- Cantrip cards follow your character level. Fire Bolt shows 2d10 at 5th level, and a homebrew cantrip can upgrade at any levels and amounts you choose.
- Skill rolls use the advantage or disadvantage a character has from a feature, and the skill list shows ADV or DIS. Homebrew can target one skill or every check with an ability.
- A resource whose recharge the app cannot detect ("after a turn without moving", "12 days") says so and has a Reset button. No rest refills it by accident.
- A used card can ask what happened, so an effect that depends on a hit or a failed save is applied only when you confirm it, and once.
- A temporary speed from an ability (a fly speed for a minute) is now actually granted and counts down.
- Homebrew: an Advanced section in the trait editor for riders, timing, per-target effects, auras, healing from damage taken and derived rules, plus "use one ability instead of another", a movement speed for a while, an outcome that refunds a use, and an infusion bonus.
- Live Play: the DM sees passive scores, defenses and running effects on the party card, can run a hidden check against passives, and can preview what a hit does before applying it. Players see their allies' conditions and the enemies' state.

### Fixed

- A character with a homebrew feature that widens the spell list could fail to load and disappear from the character list. It loads again.
- Cantrip cards showed the base dice at every level.
- Skill rolls ignored a feature that gave advantage on that skill.

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
