// The public and web builds, and any build without the private pack files: no private pack (see src/content/privateBundledPacks.ts).
import type { BundledPack } from '../bundledPacks';

export const PRIVATE_BUNDLED_PACKS: readonly BundledPack[] = [];
export type BundledHomebrew = { name: string; fileName: string; load: () => unknown };
export const PRIVATE_BUNDLED_HOMEBREW: readonly BundledHomebrew[] = [];
