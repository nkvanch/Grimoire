import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { parseRechargeThreshold, rollRecharge } from '../../../engine/combatRecharge';
import { resourceDescription } from '../../../engine/featureText';
import { rechargeLabel, isResetByHand } from '../../../engine/recharge';
import { hasSpentDawnResources, takeDawn } from '../../../engine/rest';
import { ResourceBlock, Entity, CampaignRules } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { styles } from '../tabCharacterStyles';

export function ResourcesSection({ resources, entity, onEntityUpdate, rules, setOpenResource, openResource, onResourceChange, showHitDieResult }: {
  resources: ResourceBlock;
  entity: Entity;
  onEntityUpdate: (updated: Entity) => void;
  rules: CampaignRules;
  setOpenResource: Dispatch<SetStateAction<string | null>>;
  openResource: string | null;
  onResourceChange: (resourceId: string, delta: number) => void;
  showHitDieResult: (msg: string) => void;
}) {
  return (
    <>
      {/* Resources */}
      {resources.custom.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESOURCES</Text>
          {/* Dawn is an explicit event, not a rest: only offered when a dawn resource is spent. */}
          {hasSpentDawnResources(entity) && (
            <Pressable style={styles.dawnBtn} onPress={() => onEntityUpdate(takeDawn(entity, rules))} accessibilityLabel="Dawn: restore resources that recharge at dawn">
              <Text style={styles.dawnBtnTxt}>☀ Dawn — restore dawn resources</Text>
            </Pressable>
          )}
          {resources.custom.map(r => {
            // Table-first recharge: the +/- controls below are already the
            // PRIMARY "mark recharged" path (a DM/player just taps + after
            // rolling physically). This adds only the secondary "Roll
            // Recharge" convenience for a resource whose recharge string
            // parses as "Recharge X-6" — rolls 1d6 in app and, on success,
            // restores via the exact same onResourceChange the + button
            // uses (to full, matching the real rule: a recharge success
            // restores the whole ability, not one charge). Resources that
            // don't parse this way (rest-based, start_of_turn, freeform
            // homebrew text) show no roll button — nothing invented for them.
            const rechargeThreshold = parseRechargeThreshold(r.recharge);
            return (
            <View key={r.id}>
            <View style={styles.resourceRow}>
              <Pressable style={styles.resourceInfo} onPress={() => setOpenResource(o => (o === r.id ? null : r.id))}
                accessibilityLabel={`${r.name}: ${openResource === r.id ? 'hide' : 'show'} what it is for`}>
                <Text style={styles.resourceName}>{r.name}</Text>
                <Text style={styles.resourceRecharge}>{rechargeLabel(r.recharge)}</Text>
              </Pressable>
              <View style={styles.resourceControls}>
                <Pressable style={styles.resBtn} onPress={() => onResourceChange(r.id, -1)} disabled={r.current <= 0}>
                  <Text style={[styles.resBtnTxt, r.current <= 0 && styles.disabled]}>−</Text>
                </Pressable>
                <Text style={styles.resourceCount}>
                  {r.current}<Text style={styles.resourceMax}>/{r.maximum}</Text>
                </Text>
                <Pressable style={styles.resBtn} onPress={() => onResourceChange(r.id, 1)} disabled={r.current >= r.maximum}>
                  <Text style={[styles.resBtnTxt, r.current >= r.maximum && styles.disabled]}>+</Text>
                </Pressable>
                {isResetByHand(r.recharge) && r.current < r.maximum && (
                  <Pressable style={styles.rechargeBtn} onPress={() => onResourceChange(r.id, r.maximum - r.current)}
                    accessibilityLabel={`Reset ${r.name}`}>
                    <Text style={styles.rechargeBtnTxt}>Reset</Text>
                  </Pressable>
                )}
                {rechargeThreshold !== null && r.current < r.maximum && (
                  <Pressable
                    style={styles.rechargeBtn}
                    onPress={() => {
                      const { roll, success } = rollRecharge(rechargeThreshold);
                      if (success) onResourceChange(r.id, r.maximum - r.current);
                      showHitDieResult(`${r.name}: rolled ${roll} — ${success ? 'recharged!' : 'no charge'}`);
                    }}
                  >
                    <Text style={styles.rechargeBtnTxt}>🎲</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {openResource === r.id && (() => {
              const parts = resourceDescription(entity, r);
              return (
                <View style={styles.resourceDesc}>
                  {parts.length ? parts.map(p => (
                    <Text key={p.name} style={styles.resourceDescTxt}><Text style={styles.resourceDescName}>{p.name}. </Text>{p.text}</Text>
                  )) : <Text style={styles.resourceDescTxt}>Nothing on this character describes it.</Text>}
                </View>
              );
            })()}
            </View>
            );
          })}
        </View>
      )}
    </>
  );
}
