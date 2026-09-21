// ============================================================================
// FILE: src/content/subclasses/barbarian.ts
// Ancestral Guardian, Battlerager, Giant, Storm Herald, Zealot, plus three
// different capstone features).
// ============================================================================
import { ClassProgression, } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Berserker ─────────────────────────────────────────────────────────────────

export const berserkerProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Berserker',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'frenzy', name: 'Frenzy', description: 'When you rage, you can go into a frenzy. For the duration, take one additional melee weapon attack as a bonus action each turn. When the rage ends, suffer one level of exhaustion.', source: { kind: 'subclass', refId: 'berserker' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'mindless_rage', name: 'Mindless Rage', description: 'You can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.', source: { kind: 'subclass', refId: 'berserker' }, level: 6, effects: [{ type: 'condition_immunity', target: 'charmed', operation: 'immunity', value: null, condition: 'rage_active' }, { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: 'rage_active' }], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'intimidating_presence', name: 'Intimidating Presence', description: 'Use an action to frighten a creature within 30 feet (WIS save, DC 8 + STR mod + prof). If the creature fails, it is frightened until the end of your next turn.', source: { kind: 'subclass', refId: 'berserker' }, level: 10, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: { ability: 'str' } } } } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'retaliation', name: 'Retaliation', description: 'When you take damage from a creature within 5 feet, use your reaction to make one melee weapon attack against it.', source: { kind: 'subclass', refId: 'berserker' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null } } },
      ],
    },
  ],
};

export const BARBARIAN_SUBCLASSES: SubclassProgression[] = [
  berserkerProgression,
];
