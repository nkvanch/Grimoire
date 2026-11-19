import { StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, FontWeight, Radius } from '../../theme';

// ── Styles ────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },

  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:   { paddingRight: Spacing.sm },
  backTxt:   { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  turnLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  endBtn: {
    backgroundColor: Colors.red + '33', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.red + '66',
  },
  endBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  persistErrorBanner: {
    paddingVertical: 6, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.red + '22',
    borderBottomWidth: 1, borderBottomColor: Colors.red + '66',
  },
  persistErrorTxt: { fontSize: FontSize.xs, color: Colors.red },

  scroll:       { flex: 1 },
  content:      { padding: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold, padding: Spacing.sm },

  combatantRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  combatantRowActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  combatantRowSelected: { borderColor: Colors.blue, backgroundColor: Colors.blue + '11' },
  initBox: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  initNum:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  initEditBox: {
    width: 56, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.gold,
  },
  initEditInput: {
    flex: 1, textAlign: 'center', fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    color: Colors.textPrimary, padding: 0,
  },
  initRollBtn:    { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  initRollBtnTxt: { fontSize: FontSize.md },
  combatantInfo:  { flex: 1, gap: 4 },
  combatantName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  combatantNotesTxt: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  combatantStatus:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  hpBarOuter: { width: 60, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill:  { height: '100%', borderRadius: Radius.full },
  statusLbl:  { fontSize: FontSize.xs, color: Colors.textSecondary },
  condChip: {
    backgroundColor: Colors.purple + '33', borderRadius: Radius.full,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  condChipTxt: { fontSize: 10, color: Colors.textPrimary },
  currentIndicator:    { width: 20, alignItems: 'center' },
  currentIndicatorTxt: { color: Colors.gold, fontSize: FontSize.md },
  reorderBtns:    { alignItems: 'center', gap: 2, marginRight: 4 },
  reorderBtnTxt:  { color: Colors.textSecondary, fontSize: FontSize.sm },
  reorderBtnHidden: { opacity: 0 },

  // Multi-target tools
  multiToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  multiToggleBtn: {
    alignSelf: 'flex-start', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
  },
  multiToggleBtnActive: { borderColor: Colors.blue, backgroundColor: Colors.blue + '22' },
  multiToggleTxt: { fontSize: FontSize.xs, color: Colors.textPrimary },
  groupChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  groupChip: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.blue + '66',
    backgroundColor: Colors.blue + '11', paddingVertical: 4, paddingHorizontal: Spacing.sm,
  },
  groupChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary },
  multiPanel:  { borderColor: Colors.blue + '44' },
  multiNames:  { fontSize: FontSize.xs, color: Colors.textDim },
  concWarningTxt: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 4 },

  // Quick panel
  quickPanel: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.md, gap: Spacing.sm,
  },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quickName:   { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  quickHp:     { fontSize: FontSize.sm, color: Colors.textSecondary },
  closeTxt:    { fontSize: FontSize.md, color: Colors.textDim, padding: 4 },
  quickBtns:   { flexDirection: 'row', gap: Spacing.xs },
  qBtn: { flex: 1, borderRadius: Radius.md, padding: Spacing.xs, alignItems: 'center', borderWidth: 1 },
  qBtnRed:    { backgroundColor: Colors.red + '22',    borderColor: Colors.red + '66' },
  qBtnGreen:  { backgroundColor: Colors.green + '22',  borderColor: Colors.green + '66' },
  qBtnPurple: { backgroundColor: Colors.purple + '22', borderColor: Colors.purple + '66' },
  qBtnDark:   { backgroundColor: Colors.surfaceHigh,   borderColor: Colors.border },
  qBtnTxt:    { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  rulingBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    backgroundColor: Colors.gold + '11', padding: Spacing.xs, alignItems: 'center',
  },
  rulingBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },

  inputRow:      { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  previewLine: { color: Colors.textPrimary, fontSize: FontSize.sm, marginTop: Spacing.xs, fontWeight: FontWeight.bold },
  dmgTypeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Spacing.xs },
  dmgTypeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border,
  },
  dmgTypeChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  dmgTypeChipTxt:    { fontSize: 11, color: Colors.textSecondary },
  dmgTypeChipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  numInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.lg, textAlign: 'center',
  },
  submitBtn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm },
  btnDisabled:   { opacity: 0.4 },
  submitBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  condPicker:   { gap: Spacing.xs },
  condSearch: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
  },
  condRowItem: {
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  condRowAdd:  { opacity: 0.8 },
  condItemTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, textTransform: 'capitalize' },

  legendaryWrap:   { gap: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs },
  legendaryHeader: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gold },
  legendaryRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs,
  },
  legendaryName:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  legendaryDesc:   { fontSize: FontSize.xs, color: Colors.textDim },
  legendaryReason: { fontSize: FontSize.xs, color: Colors.red },

  rechargeRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs,
  },
  rechargeManualBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  rechargeManualBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  rechargeRollBtn: {
    width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceHigh,
  },
  rechargeRollBtnTxt: { fontSize: FontSize.md },

  // Setup mode
  setupRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row', alignItems: 'center',
  },
  setupName: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  addBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  addBtnAdded: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  addBtnTxt:   { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  addMonsterBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  addMonsterBtnTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  startBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  startBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },

  prepPreview: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold,
    padding: Spacing.md, marginBottom: Spacing.md, gap: 4,
  },
  prepPreviewTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  prepPreviewDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary },
  prepPreviewMeta:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 4 },
  prepPreviewRow:   { fontSize: FontSize.sm, color: Colors.textPrimary },
  prepStartBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  prepStartBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  waveSection: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginBottom: Spacing.md,
  },
  waveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  waveName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  waveMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  waveDeployBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  waveDeployTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.xs },

  turnBar: {
    backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: Spacing.sm,
  },
  endTurnBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  endTurnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
});
