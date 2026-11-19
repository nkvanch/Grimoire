import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { spellRepo } from '../../../content/spellRepo';
import type { SpellIndexEntry } from '../../../content/spellRepo.types';
import { RulesetId, Spell } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { isNonSrd, NonSrdBadge } from '../../NonSrdBadge';
import { styles } from './spellsScreenStyles';

// ── Spell row (select + expandable description) ───────────────────────────────

export function SpellRow({
  spell, selected, disabled, isHomebrew, rulesetId, onToggle,
}: {
  spell: SpellIndexEntry; selected: boolean; disabled: boolean; isHomebrew?: boolean; rulesetId?: RulesetId | null; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Tier 1 doesn't carry description — homebrew spells are already full
  // Spell objects at runtime (structurally satisfy SpellIndexEntry), so
  // their description is read straight off; official spells are fetched
  // on demand the moment the row is expanded.
  const [description, setDescription] = useState<string | null>(
    isHomebrew ? (spell as unknown as Spell).description : null
  );
  useEffect(() => {
    if (!open || description !== null || isHomebrew) return;
    let cancelled = false;
    void spellRepo.ensureLoaded([spell.id]).then(() => {
      if (!cancelled) setDescription(spellRepo.getSpellSync(spell.id, rulesetId)?.description ?? '');
    });
    return () => { cancelled = true; };
  }, [open, spell.id, description, isHomebrew]);

  return (
    <View style={[styles.spellCard, selected && styles.spellCardSelected, disabled && styles.spellCardDisabled]}>
      <View style={styles.spellRowTop}>
        <Pressable style={styles.spellSelect} onPress={onToggle} disabled={disabled}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.spellCardLeft}>
            <View style={styles.spellNameRow}>
              <Text style={styles.spellName}>{spell.name}</Text>
              {isHomebrew && (
                <View style={styles.homebrewTag}>
                  <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                </View>
              )}
              {!isHomebrew && isNonSrd(spell.srd, spell.rulesetId) && <NonSrdBadge />}
            </View>
            <Text style={styles.spellMeta}>
              {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}  ·  {spell.school}  ·  {spell.castingTime}
              {spell.concentration ? '  ·  Concentration' : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.infoBtn} onPress={() => setOpen(o => !o)} hitSlop={8}>
          <Text style={styles.infoBtnTxt}>{open ? '▲' : 'ⓘ'}</Text>
        </Pressable>
      </View>
      {open && (
        <Text style={styles.spellDesc}>{description ?? 'Loading…'}</Text>
      )}
    </View>
  );
}
