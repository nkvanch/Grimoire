import { StyleSheet } from 'react-native';
import { Spacing, FontSize, Colors, FontWeight, Radius } from '../../theme';

export const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  section:      { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },

  universalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  universalChevron: { fontSize: FontSize.xs, color: Colors.textDim },
  universalRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginTop: Spacing.xs, gap: 2,
  },
  universalName:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  universalBlurb:  { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  star:       { fontSize: FontSize.lg, color: Colors.textDim },
  starActive: { color: Colors.gold },
  cardBody:    { flex: 1, gap: 3 },
  cardName:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardL1:      { fontSize: FontSize.xs, color: Colors.textDim },
  cardL2:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardL3:      { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  cardText:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, marginTop: 4 },
  cardOutcome: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  cardUnavail: { fontSize: FontSize.xs, color: Colors.red, marginTop: 2 },

  useBtn:            { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  useBtnDisabled:    { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  useBtnTxt:         { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  useBtnTxtDisabled: { color: Colors.textDim },

  empty:      { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyIcon:  { fontSize: 48 },
  emptyTxt:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  emptySubTxt:{ fontSize: FontSize.sm, color: Colors.textDim },

  endTurnBtn: {
    alignSelf: 'flex-start', marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  endTurnBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  attackActionBtn: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  attackActionBtnDisabled: { opacity: 0.4 },
  attackActionBtnTxt: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  attackActionBtnSub: { color: Colors.white, fontSize: FontSize.sm },

  wildShapeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.purple + '18', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.purple + '66',
    padding: Spacing.md,
  },
  wildShapeBannerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.purple },
  wildShapeBannerSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  revertBtn: { backgroundColor: Colors.purple, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  revertBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm, overflow: 'hidden',
  },
  modalColorBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  modalName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 4 },
  modalL1:   { fontSize: FontSize.xs, color: Colors.textDim },
  modalL2:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalL3:   { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  modalOutcome: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  riderBtn:    { borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  riderBtnOff: { borderColor: Colors.border, opacity: 0.6 },
  riderBtnTxt: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  riderBtnTxtOff: { color: Colors.textSecondary },
  riderApplied: { color: Colors.gold, fontSize: FontSize.sm, marginTop: Spacing.xs },

  rollPrompt:  { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  rollExpr:    { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  rollBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  rollBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  critToggle: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  critToggleActive:    { borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  critToggleTxt:        { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  critToggleTxtActive:  { color: Colors.red },

  resultBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.gold + '66',
  },
  resultTotal:     { fontSize: 48, fontWeight: FontWeight.bold, color: Colors.gold },
  resultBreakdown: { fontSize: FontSize.md, color: Colors.textSecondary },
  resultExpr:      { fontSize: FontSize.xs, color: Colors.textDim },

  closeBtn:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  closeBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.md },

  // Activation option picker (A-57)
  optionRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  optionLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  optionDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
