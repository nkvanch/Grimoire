import { StyleSheet } from 'react-native';
import { Spacing, Colors, Radius, FontSize, FontWeight } from '../../theme';

export const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  group: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, backgroundColor: Colors.surfaceHigh,
  },
  groupTitle:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  groupBody:     { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  featureChevron:{ fontSize: FontSize.xs, color: Colors.textDim },
  featureRemoveBtn: { fontSize: FontSize.md, color: Colors.red, paddingHorizontal: Spacing.sm },

  changeBgBtn: {
    backgroundColor: Colors.blue + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.blue + '66',
    padding: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm,
  },
  changeBgBtnTxt: { color: Colors.blue, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  addFeatRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  addFeatBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66', borderStyle: 'dashed',
    padding: Spacing.sm, alignItems: 'center',
  },
  addFeatBtnHalf: { flex: 1 },
  addFeatBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  featureRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  featureDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },

  spellMeta2: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  spellMetaPill: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  spellMetaLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  spellMetaValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue },

  slotGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  slotBlock: { alignItems: 'center', gap: 4, minWidth: 48 },
  slotTier:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  slotPips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  slotPip:   { width: 10, height: 10, borderRadius: Radius.full, backgroundColor: Colors.blue },
  slotPipUsed: { backgroundColor: Colors.border },
  slotCount: { fontSize: FontSize.xs, color: Colors.textDim },

  spellSubGroup: { gap: Spacing.xs, marginBottom: Spacing.sm },
  spellSubTitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, marginBottom: 4 },

  spellCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
    padding: Spacing.sm, marginBottom: 4,
  },
  spellHeader:  { flexDirection: 'row', alignItems: 'flex-start' },
  spellInfo:    { flex: 1, gap: 2 },
  spellName:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  spellL1:      { fontSize: FontSize.xs, color: Colors.textDim },
  spellL2:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  spellL3:      { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  spellExpanded:{ marginTop: Spacing.sm, gap: Spacing.xs },
  spellDesc:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  spellUpcast:  { fontSize: FontSize.sm, color: Colors.blue, lineHeight: 18 },
  spellMeta:    { fontSize: FontSize.xs, color: Colors.textDim },
  spellComponents:{ fontSize: FontSize.xs, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', padding: Spacing.sm },
  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyIcon: { fontSize: 48 },
  emptyTxt:  { fontSize: FontSize.lg, color: Colors.textSecondary },

  // Pending choices
  pendingRow:    { paddingVertical: Spacing.sm, gap: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pendingPrompt: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  pendingMeta:   { fontSize: FontSize.xs, color: Colors.textDim },
  pendingNote:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipSelected:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipDisabled:    { opacity: 0.4 },
  chipTxt:         { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTxtSelected: { color: Colors.gold, fontWeight: FontWeight.bold },
  resolveBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center', marginTop: 2,
  },
  resolveBtnDisabled: { opacity: 0.4 },
  resolveBtnTxt:      { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  situationalRow:      { paddingVertical: Spacing.sm, gap: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  situationalSource:   { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  situationalQuestion: { fontSize: FontSize.sm, color: Colors.textPrimary },
  situationalBtns:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  situationalBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  situationalBtnYesActive: { borderColor: Colors.green, backgroundColor: Colors.green + '22' },
  situationalBtnNoActive:  { borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  situationalBtnTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  situationalBtnTxtActive: { color: Colors.textPrimary },
  situationalUnset:        { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  asiModalRoot: { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.xl + 8 },
  asiDone:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.lg },
  asiDoneTxt:   { fontSize: FontSize.lg, color: Colors.textPrimary },
});
