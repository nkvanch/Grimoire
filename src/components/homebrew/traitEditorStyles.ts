import { StyleSheet } from 'react-native';
import { FontSize, Colors, FontWeight, Radius, Spacing } from '../../theme';

export const styles = StyleSheet.create({
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  smallInput: { width: 80 },
  textArea: { minHeight: 100 },
  abiGrid: { flexDirection: 'row', gap: Spacing.xs },
  abiBox:  { flex: 1, alignItems: 'center', gap: 4 },
  abiLabel:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  abiInput:{ backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, color: Colors.textPrimary, width: '100%', textAlign: 'center' },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  effectGroupBlock: { marginTop: Spacing.xs, gap: 4 },
  effectGroupLabel: { fontSize: 10, color: Colors.textDim, letterSpacing: 1, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  searchResults: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchResultTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  searchResultAdd: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  selectedSpellRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gold + '11', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm,
  },
  selectedSpellTxt: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  selectedSpellChange: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  spellGrantCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: 6,
  },
  spellGrantName: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  senseInputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  senseAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  senseAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  traitCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  traitCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  traitCardMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  traitCardCaret: { fontSize: FontSize.lg, color: Colors.textDim },

  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  traitModalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '85%',
  },
  traitModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: Spacing.md, textAlign: 'center' },
  effectPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  effectNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, fontStyle: 'italic' },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inlineLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: Colors.border },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  toggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  traitModalBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  traitDeleteBtn: { flex: 1, backgroundColor: Colors.red + '22', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '66', padding: Spacing.sm, alignItems: 'center' },
  traitDeleteTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  traitDoneBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  traitDoneTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
