// ============================================================================
// FILE: src/content/backgrounds/characteristics.ts
// Suggested personality traits, ideals, bonds and flaws a background offers in
// character creation, as data rather than a table inside a screen.
//
// The only official table is the Acolyte's, the SRD 5.1 sample background, word
// for word from System Reference Document 5.1 (CC-BY-4.0, "Backgrounds",
// pp. 60–61). The 2024 backgrounds in SRD 5.2.1 have no such tables. It lives
// here, keyed by id, instead of on the background record so the signed SRD 5.1
// pack stays as it is. A homebrew background carries its own table in
// Background.characteristics, written in the background builder.
// ============================================================================
import type { Background, BackgroundCharacteristics } from '../../engine/types';

export const OFFICIAL_BACKGROUND_CHARACTERISTICS: Readonly<Record<string, BackgroundCharacteristics>> = {
  acolyte: {
    traits: [
      'I idolize a particular hero of my faith, and constantly refer to that person’s deeds and example.',
      'I can find common ground between the fiercest enemies, empathizing with them and always working toward peace.',
      'I see omens in every event and action. The gods try to speak to us, we just need to listen',
      'Nothing can shake my optimistic attitude.',
      'I quote (or misquote) sacred texts and proverbs in almost every situation.',
      'I am tolerant (or intolerant) of other faiths and respect (or condemn) the worship of other gods.',
      'I’ve enjoyed fine food, drink, and high society among my temple’s elite. Rough living grates on me.',
      'I’ve spent so long in the temple that I have little practical experience dealing with people in the outside world.',
    ],
    ideals: [
      'Tradition. The ancient traditions of worship and sacrifice must be preserved and upheld. (Lawful)',
      'Charity. I always try to help those in need, no matter what the personal cost. (Good)',
      'Change. We must help bring about the changes the gods are constantly working in the world. (Chaotic)',
      'Power. I hope to one day rise to the top of my faith’s religious hierarchy. (Lawful)',
      'Faith. I trust that my deity will guide my actions. I have faith that if I work hard, things will go well. (Lawful)',
      'Aspiration. I seek to prove myself worthy of my god’s favor by matching my actions against his or her teachings. (Any)',
    ],
    bonds: [
      'I would die to recover an ancient relic of my faith that was lost long ago.',
      'I will someday get revenge on the corrupt temple hierarchy who branded me a heretic.',
      'I owe my life to the priest who took me in when my parents died.',
      'Everything I do is for the common people.',
      'I will do anything to protect the temple where I served.',
      'I seek to preserve a sacred text that my enemies consider heretical and seek to destroy.',
    ],
    flaws: [
      'I judge others harshly, and myself even more severely.',
      'I put too much trust in those who wield power within my temple’s hierarchy.',
      'My piety sometimes leads me to blindly trust those that profess faith in my god.',
      'I am inflexible in my thinking.',
      'I am suspicious of strangers and expect the worst of them.',
      'Once I pick a goal, I become obsessed with it to the detriment of everything else in my life.',
    ],
  },
};

const hasAny = (c: BackgroundCharacteristics | undefined): c is BackgroundCharacteristics =>
  !!c && [c.traits, c.ideals, c.bonds, c.flaws].some(list => Array.isArray(list) && list.length > 0);

/** The table creation offers for a background: its own (homebrew), else the official one for its id, else none. */
export function characteristicsFor(bg: Pick<Background, 'id' | 'characteristics'> | undefined): BackgroundCharacteristics | undefined {
  if (!bg) return undefined;
  if (hasAny(bg.characteristics)) return bg.characteristics;
  const official = OFFICIAL_BACKGROUND_CHARACTERISTICS[bg.id];
  return hasAny(official) ? official : undefined;
}
