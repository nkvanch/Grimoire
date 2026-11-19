// src/store/diceLogStore.ts
// Shared dice-roll log. The floating GlobalDiceRoller and any screen that wants
// to surface a roll (e.g. the exploration tab's tap-to-roll skills) both read
// and write here, so a roll triggered anywhere shows up in one place.
import { create } from 'zustand';
import { DiceRoll } from '../engine/types';
import { rollExpression } from '../engine/dice';

type DiceLogStore = {
  history: DiceRoll[];
  /** Push an already-computed roll (e.g. from a skill tap). */
  pushRoll: (roll: DiceRoll) => void;
  /** Roll an expression and push the result; returns it for immediate use. */
  /** The roll a screen is already showing itself: logged to the shared history, but the roller does not pop open for it. */
  quietId: string | null;
  rollAndLog: (expression: string, label?: string, quiet?: boolean) => DiceRoll;
  clear: () => void;
};

export const useDiceLogStore = create<DiceLogStore>(set => ({
  history: [],
  quietId: null,
  pushRoll: (roll) => set(state => ({ history: [roll, ...state.history].slice(0, 20) })),
  rollAndLog: (expression, label, quiet = false) => {
    const result = rollExpression(expression, label);
    set(state => ({ history: [result, ...state.history].slice(0, 20), quietId: quiet ? result.id : null }));
    return result;
  },
  clear: () => set({ history: [] }),
}));
