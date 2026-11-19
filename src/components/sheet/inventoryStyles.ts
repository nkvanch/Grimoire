import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontSize, FontWeight } from '../../theme';

export const addStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl,
    maxHeight: '90%',
  },
  title:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickToggle: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  quickToggleActive: { backgroundColor: Colors.red + '22', borderColor: Colors.red + '66' },
  quickToggleTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  quickToggleTxtActive: { color: Colors.red },
  quickForm: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.sm, gap: Spacing.xs,
  },
  quickInput: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },
  quickInputMulti: { minHeight: 60, textAlignVertical: 'top' },
  quickAddBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  quickAddBtnDisabled: { opacity: 0.4 },
  quickAddBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  attunementToggle: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: 2 },
  filterToggle: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  filterToggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filterPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xs, marginBottom: Spacing.xs,
  },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  group:       { marginBottom: 2 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginBottom: 2,
  },
  groupEmoji:  { fontSize: FontSize.sm },
  groupLabel:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, letterSpacing: 1, flex: 1 },
  groupCount:  { fontSize: FontSize.xs, color: Colors.textDim },
  groupCaret:  { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: 4 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  // Owned rows used to dim to 0.5 opacity — dropped that now that "+ Add"
  // stays live on them (they're still addable, not a disabled state).
  itemRowOwned: {},
  itemInfo:     { flex: 1 },
  itemNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName:     { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  itemNameOwned:{ color: Colors.textPrimary },
  itemProps:    { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  itemCost:     { fontSize: FontSize.xs, color: Colors.gold, marginTop: 1 },
  itemActions:  { alignItems: 'flex-end', gap: 4 },
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  addBtnTxt:   { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  ownedBadge:  { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  empty:       { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  cancelBtn:   { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:   { color: Colors.textSecondary, fontSize: FontSize.md },
});

export const currStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  grid:  { flexDirection: 'row', gap: Spacing.sm },
  coinEdit:  { flex: 1, alignItems: 'center', gap: Spacing.xs },
  coinLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  coinInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    textAlign: 'center', width: '100%',
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', padding: Spacing.sm },
  cancelTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
  saveBtn:   { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  saveTxt:   { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

export const infuseStyles = StyleSheet.create({
  capNote:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  warn:      { fontSize: FontSize.xs, color: Colors.red },
  stepLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, marginTop: Spacing.xs },
  pickList:  { maxHeight: 140 },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginBottom: 4,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowTxt:      { fontSize: FontSize.sm, color: Colors.textPrimary },
});

export const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Weight
  weightHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightValue:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  weightBarOuter: {
    width: '100%', height: 6, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden', marginTop: 2,
  },
  weightBarFill: { height: '100%', borderRadius: Radius.full },
  overweight:    { fontSize: FontSize.xs, color: Colors.red },
  largePCNote:   {
    fontSize: FontSize.xs, color: Colors.gold, lineHeight: 16,
    backgroundColor: Colors.gold + '11', borderRadius: Radius.sm,
    padding: Spacing.xs, borderLeftWidth: 2, borderLeftColor: Colors.gold,
  },

  // Currency
  editCurrBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  editCurrTxt:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  currencyRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  coinBox:      { alignItems: 'center', gap: 2 },
  coinValue:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  coinLabel:    { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1 },

  // Add item button
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  addBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  addBtnDisabled: { opacity: 0.4 },
  addItemRow: {
    paddingVertical: Spacing.sm, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs,
  },

  // Item rows
  itemWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.xs,
  },
  itemMain:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemProps: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1, lineHeight: 14 },
  itemQty:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemInfused: { fontSize: FontSize.xs, color: Colors.purple, marginTop: 2, fontWeight: FontWeight.bold },
  itemAttunement: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  qtyStepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs, paddingBottom: Spacing.xs,
  },
  qtyStepperLabel: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: {
    width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  qtyValue:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 24, textAlign: 'center' },
  qtyInput: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary,
    minWidth: 40, textAlign: 'center', backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 2, paddingHorizontal: 4,
  },
  customizeBtn: {
    minHeight: 44, justifyContent: 'center', marginTop: Spacing.xs, paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', backgroundColor: Colors.gold + '14',
  },
  customizeTxt: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  baseArmorBox: { marginTop: Spacing.xs },
  baseArmorBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md },
  baseArmorTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  baseArmorTxtNeeded: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  baseArmorList: { gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  baseArmorOption: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceHigh,
  },
  baseArmorOptionOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '14' },
  baseArmorOptionTxt: { color: Colors.textPrimary, fontSize: FontSize.sm },
  baseArmorOptionTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
  removeInfusionBtn: {
    alignItems: 'center', paddingVertical: Spacing.xs, marginBottom: Spacing.xs,
    backgroundColor: Colors.red + '11', borderRadius: Radius.sm,
  },
  removeInfusionTxt: { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
  expandCaret: { fontSize: FontSize.xs, color: Colors.textDim, paddingHorizontal: 4 },
  itemDesc: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  itemDescTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  toggleBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnEquipped: { borderColor: Colors.gold + '88', backgroundColor: Colors.gold + '22' },
  toggleTxt:         { fontSize: FontSize.sm, color: Colors.textSecondary },
  toggleTxtEquipped: { color: Colors.gold, fontWeight: FontWeight.bold },

  attuneBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  attuneBtnActive: { borderColor: Colors.purple + '88', backgroundColor: Colors.purple + '22' },
  attuneTxt:        { fontSize: FontSize.sm, color: Colors.textSecondary },
  attuneTxtActive:  { color: Colors.purple, fontWeight: FontWeight.bold },

  removeBtn: { padding: 4 },
  removeTxt: { fontSize: FontSize.md, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  loadoutSaveRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', marginTop: Spacing.xs },
  loadoutInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.textPrimary,
  },
  loadoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs,
  },
  loadoutInfo: { flex: 1 },
  loadoutName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  loadoutMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  loadoutBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  loadoutBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  loadoutBtnDelete: { padding: 4 },
  loadoutBtnDeleteTxt: { fontSize: FontSize.md, color: Colors.textDim },
});
