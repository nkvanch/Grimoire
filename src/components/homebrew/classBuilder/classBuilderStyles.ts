import { StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../theme';

// ── Styles ────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor:   Colors.surfaceHigh,
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.xs,
  },
  sectionNum: {
    width: 24, height: 24, borderRadius: Radius.full,
    backgroundColor: Colors.gold + '33', borderWidth: 1, borderColor: Colors.gold + '66',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  sectionTitle:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  // Form elements
  fieldLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.sm,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, marginTop: 2 },
  warn: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 4 },

  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textArea:   { minHeight: 100 },
  smallInput: { maxWidth: 80 },

  // Chips
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.sm, marginTop: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:       { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  chipTxtActive: { color: Colors.gold },

  inlineAddRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  inlineAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  inlineAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  equipResults: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  equipResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  equipResultTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  equipResultAdd: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // Spellcasting toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.xs,
  },
  toggle: {
    width: 44, height: 24, borderRadius: Radius.full,
    backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn:      { backgroundColor: Colors.green + '88' },
  toggleThumb: {
    width: 20, height: 20, borderRadius: Radius.full,
    backgroundColor: Colors.textDim, alignSelf: 'flex-start',
  },
  toggleThumbOn: { backgroundColor: Colors.green, alignSelf: 'flex-end' },
  toggleLabel:   { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },

  spellConfig: { gap: Spacing.sm, marginTop: Spacing.xs },

  // Slot style radio rows
  styleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  styleRowActive:  { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  styleRadio: {
    width: 18, height: 18, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  styleRadioActive: { borderColor: Colors.gold },
  styleRadioDot:   { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.gold },
  styleLabel:      { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  styleLabelActive:{ color: Colors.gold },
  styleSub:        { fontSize: FontSize.xs, color: Colors.textDim },

  // Per-level features
  emptyNote:         { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  featureLevelGroup: { gap: Spacing.xs },
  featureLevelLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 2, marginTop: Spacing.sm,
  },
  featureItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm,
  },
  featureItemBody:  { flex: 1 },
  featureItemName:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureItemDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },
  featureDeleteBtn: { paddingLeft: Spacing.xs },
  featureDeleteTxt: { color: Colors.textDim, fontSize: FontSize.md },

  addFeatureBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  addFeatureBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // ASI grid
  asiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  asiCell: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  asiCellActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  asiCellTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  asiCellTxtActive: { color: Colors.gold },

  // Footer
  footer: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.sm, backgroundColor: Colors.surfaceHigh,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  testBtn:     { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt:  { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:     { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Add feature modal
  modalBackdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderTopWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalBtns:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center',
  },
  modalCancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  modalAddBtn:    { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  modalAddTxt:    { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
