import { Dispatch, SetStateAction } from 'react';
import { InfoRow } from '../../../content/characterInfo';
import { itemRepo } from '../../../content/itemRepo';
import { TimelineCategory } from '../../../db/timelineRepo';
import type { ItemEdits } from '../../../engine/itemCustomize';
import { HitDiceRecoveryAllocation } from '../../../engine/rest';
import { Entity, CampaignRules, SessionLogEntry, Item, Identity, Issue } from '../../../engine/types';
import { ExportFormat, ExportAction } from '../../../io/exportShare';
import { VersionNotes } from '../../../store/pinningService';
import { ExportFormatSheet } from '../../ExportFormatSheet';
import { CharacterHistoryModal } from '../CharacterHistoryModal';
import { CharacterInfoModal } from '../CharacterInfoModal';
import { EquipmentPreviewModal } from '../EquipmentPreviewModal';
import { FreeEditModal } from '../FreeEditModal';
import { IssuesModal } from '../IssuesModal';
import { ItemCustomizeModal } from '../ItemCustomizeModal';
import { RenameModal } from '../RenameModal';
import { RestPreviewModal } from '../RestPreviewModal';
import { RulesetChangeModal } from '../RulesetChangeModal';
import { VersionsModal } from '../VersionsModal';

export function SheetModals({
  freeEditOpen, entity, rules, mutate, setFreeEditOpen, rulesetChangeOpen, setRulesetChangeOpen, historyOpen, id, setHistoryOpen,
  activeCampaignSessionLog, customizing, saveCustomizedItem, setCustomizing, infoOpen, identity, infoRows, setInfoOpen, handlePortrait,
  renameOpen, handleRename, setRenameOpen, versions, versionsOpen, handlePinToInstalled, setVersionsOpen, issuesOpen, issues, setIssuesOpen,
  restPreview, handleRest, setRestPreview, equipPreview, confirmEquipPreview, setEquipPreview, homebrewItems, exportSheetOpen,
  handleExportFormat, setExportSheetOpen,
}: {
  freeEditOpen: boolean;
  entity: Entity;
  rules: CampaignRules;
  mutate: (updater: (e: Entity) => Entity, label?: string, category?: TimelineCategory, operations?: readonly string[]) => void;
  setFreeEditOpen: Dispatch<SetStateAction<boolean>>;
  rulesetChangeOpen: boolean;
  setRulesetChangeOpen: Dispatch<SetStateAction<boolean>>;
  historyOpen: boolean;
  id: string;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  activeCampaignSessionLog: SessionLogEntry[] | undefined;
  customizing: { instanceId: string; item: Item; makesCopy: boolean; } | null;
  saveCustomizedItem: (edits: ItemEdits) => Promise<void>;
  setCustomizing: Dispatch<SetStateAction<{ instanceId: string; item: Item; makesCopy: boolean; } | null>>;
  infoOpen: boolean;
  identity: Identity;
  infoRows: InfoRow[];
  setInfoOpen: Dispatch<SetStateAction<boolean>>;
  handlePortrait: (portraitUri: string | undefined) => void;
  renameOpen: boolean;
  handleRename: (name: string) => void;
  setRenameOpen: Dispatch<SetStateAction<boolean>>;
  versions: VersionNotes | null;
  versionsOpen: boolean;
  handlePinToInstalled: () => void;
  setVersionsOpen: Dispatch<SetStateAction<boolean>>;
  issuesOpen: boolean;
  issues: Issue[];
  setIssuesOpen: Dispatch<SetStateAction<boolean>>;
  restPreview: "short" | "long" | null;
  handleRest: (kind: "short" | "long", hitDiceAllocation?: HitDiceRecoveryAllocation) => void;
  setRestPreview: Dispatch<SetStateAction<"short" | "long" | null>>;
  equipPreview: { kind: "equip" | "unequip"; itemName: string; before: Entity; after: Entity; } | null;
  confirmEquipPreview: () => void;
  setEquipPreview: Dispatch<SetStateAction<{ kind: "equip" | "unequip"; itemName: string; before: Entity; after: Entity; } | null>>;
  homebrewItems: Item[];
  exportSheetOpen: boolean;
  handleExportFormat: (format: ExportFormat, action: ExportAction) => Promise<void>;
  setExportSheetOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* FREEEDIT-PERF-1: all 6 modals below used to be unconditionally
          mounted with only `visible` gating RN Modal's native display —
          the component body (state, effects, any data fetch/derivation)
          still ran on every sheet render regardless of whether the modal
          was open, and each one also added to the render cost paid by
          every OTHER open/close of any of them (all live in this same
          parent, so any local state change here re-renders every sibling).
          Gating the element itself, same pattern already used for
          MonsterPreview/AddItemModal, means each only does its own work
          while actually open. */}

      {/* Free-edit modal (solo/prep only) */}
      {freeEditOpen && (
        <FreeEditModal
          visible={freeEditOpen}
          entity={entity}
          rules={rules}
          onApply={updated => mutate(() => updated, 'Free edit', 'other')}
          onClose={() => setFreeEditOpen(false)}
        />
      )}

      {/* LIVE-RULESET-1: commits through the SAME mutation choke point as
          every other character change — persistence/undo/timeline/sync all
          come for free, nothing bespoke. `updated` (preview.after) is
          applied verbatim, matching every other preview-then-commit modal
          in this app (never re-derive the change on confirm). */}
      {rulesetChangeOpen && (
        <RulesetChangeModal
          visible={rulesetChangeOpen}
          entity={entity}
          rules={rules}
          onConfirm={(updated, label) => {
            mutate(() => updated, label, 'ruleset');
            setRulesetChangeOpen(false);
          }}
          onCancel={() => setRulesetChangeOpen(false)}
        />
      )}

      {historyOpen && (
        <CharacterHistoryModal
          visible={historyOpen}
          entityId={id}
          onClose={() => setHistoryOpen(false)}
          sessionLog={activeCampaignSessionLog}
        />
      )}

      <ItemCustomizeModal
        visible={!!customizing}
        item={customizing?.item ?? null}
        makesCopy={customizing?.makesCopy ?? true}
        onSave={(edits) => { void saveCustomizedItem(edits); }}
        onClose={() => setCustomizing(null)}
      />
      <CharacterInfoModal visible={infoOpen} name={identity.name || ''} rows={infoRows} onClose={() => setInfoOpen(false)}
        portraitUri={identity.portraitUri} onPortrait={handlePortrait} />
      <RenameModal visible={renameOpen} name={identity.name || ''} onSave={handleRename} onClose={() => setRenameOpen(false)} />

      {versions && <VersionsModal visible={versionsOpen} notes={versions} onPin={handlePinToInstalled} onClose={() => setVersionsOpen(false)} />}

      {issuesOpen && (
        <IssuesModal
          visible={issuesOpen}
          issues={issues}
          onClose={() => setIssuesOpen(false)}
        />
      )}

      {restPreview !== null && (
        <RestPreviewModal
          visible={restPreview !== null}
          kind={restPreview ?? 'short'}
          entity={entity}
          rules={rules}
          onConfirm={(hitDiceAllocation) => { handleRest(restPreview, hitDiceAllocation); setRestPreview(null); }}
          onCancel={() => setRestPreview(null)}
        />
      )}

      {equipPreview !== null && (
        <EquipmentPreviewModal
          visible={equipPreview !== null}
          kind={equipPreview?.kind ?? 'equip'}
          itemName={equipPreview?.itemName ?? ''}
          before={equipPreview?.before ?? null}
          after={equipPreview?.after ?? null}
          onConfirm={confirmEquipPreview}
          onCancel={() => setEquipPreview(null)}
          nameOf={id => itemRepo.getItemSync(id)?.name ?? homebrewItems.find(i => i.id === id)?.name ?? id}
        />
      )}

      {exportSheetOpen && (
        <ExportFormatSheet
          visible={exportSheetOpen}
          kind="character"
          title={`Export "${entity.identity.name || 'Character'}"`}
          onSelect={(...args) => { void handleExportFormat(...args); }}
          onClose={() => setExportSheetOpen(false)}
        />
      )}
    </>
  );
}
