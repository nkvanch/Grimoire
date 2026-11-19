import { StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../theme';

// ── Styles ────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },


  scroll:        { flex: 1 },
  content:       { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  contentCenter: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.md,
  },

  // Section
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    letterSpacing: 2, fontWeight: FontWeight.bold,
  },
  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  packRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  packName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  packMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  packToggle: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.green + '66',
    backgroundColor: Colors.green + '22', paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  packToggleBanned:    { borderColor: Colors.red + '66', backgroundColor: Colors.red + '22' },
  packToggleTxt:        { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },
  packToggleTxtBanned:  { color: Colors.red },

  // Notes
  notesInput:   { minHeight: 90 },
  notesReadOnly:{ fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },

  // Quests
  questRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm, paddingVertical: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  questChip: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, marginTop: 2,
  },
  questChipTxt:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  questBody:     { flex: 1 },
  questName:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  questDesc:     { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  questActions:  { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  questActionBtn:{ padding: 4 },
  questActionTxt:{ fontSize: FontSize.md, color: Colors.textDim, fontWeight: FontWeight.bold },

  // Session log
  logEntry: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.sm, gap: Spacing.xs,
  },
  logEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logDate:       { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  logDeleteTxt:  { fontSize: FontSize.sm, color: Colors.textDim },
  logSummary:    { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  showMoreTxt:   { fontSize: FontSize.xs, color: Colors.gold, marginTop: Spacing.xs },

  // Add buttons (shared)
  addBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center',
  },
  addBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Party
  partyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  partyInfo:  { flex: 1 },
  partyName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  partySub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  partyRight: { alignItems: 'flex-end', gap: 4 },
  changeLink: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  pickRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hpTxt:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  hpBarOuter: { width: 80, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill:  { height: '100%', borderRadius: Radius.full },

  // Campaign header card (DM view)
  campaignCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.md, gap: Spacing.md,
  },
  campaignName:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  campaignMeta:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  noNetworkNotice:   { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  noNetworkTxt:      { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  dmBtn:             { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  dmBtnSecondary:    { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dmBtnTxt:          { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Close button (player view)
  leaveBtn: {
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.red + '66', backgroundColor: Colors.red + '11',
  },
  leaveBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // No campaign view
  emptyIcon:    { fontSize: 64 },
  emptyHeading: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  nicknameRow:  { gap: 6 },
  nickLabel:    { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  nickInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  actionGroup: { gap: Spacing.sm, alignSelf: 'stretch' },
  liveHostLink: { alignSelf: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  liveHostLinkTxt: { fontSize: FontSize.sm, color: Colors.textDim, fontWeight: FontWeight.bold },
  howItWorks: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.xs, alignSelf: 'stretch', marginTop: Spacing.sm,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: 4 },
  howItem:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  savedRowName:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  savedRowMeta:       { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  savedRowDelete:     { padding: Spacing.xs },
  savedRowDeleteTxt:  { fontSize: FontSize.md },

  // Modals
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  backdropTapArea: { flex: 1 },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl,
  },
  modalTitle:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalSub:      { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  modalBtns:     { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  primaryBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  secondaryBtn:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  codeInput:     { textAlign: 'center', fontSize: FontSize.xl, letterSpacing: 8, fontWeight: FontWeight.bold },
  btnDisabled:   { opacity: 0.4 },
  primaryBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  cancelBtn:     { alignItems: 'center', padding: Spacing.sm, flex: 1 },
  cancelTxt:     { color: Colors.textSecondary, fontSize: FontSize.md },

  // Create Campaign wizard
  wizSheet:      { maxHeight: '88%' },
  wizStepLabel:  { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center', letterSpacing: 1, fontWeight: FontWeight.bold },
  wizScroll:     { flexGrow: 0, marginTop: Spacing.sm },
  wizFieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  wizHint:       { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  wizChipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  wizChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
  },
  wizChipActive:    { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  wizChipTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  wizChipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  wizToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  wizToggleLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  wizToggleHint:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  wizSwitch: {
    width: 44, height: 26, borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, padding: 2, justifyContent: 'center',
  },
  wizSwitchOn:      { backgroundColor: Colors.gold + '44', borderColor: Colors.gold },
  wizSwitchKnob:    { width: 20, height: 20, borderRadius: Radius.full, backgroundColor: Colors.textDim },
  wizSwitchKnobOn:  { backgroundColor: Colors.gold, alignSelf: 'flex-end' },
  wizReviewLine:    { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  wizReviewLabel:   { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  wizFooter:        { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
