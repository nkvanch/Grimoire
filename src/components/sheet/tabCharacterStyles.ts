import { StyleSheet } from 'react-native';
import { Spacing, Colors, Radius, FontSize, FontWeight } from '../../theme';

// ── Styles ────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  hpBlock: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.sm,
  },
  hpLabel:   { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  hpNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hpCurrent: { fontSize: 56, fontWeight: FontWeight.bold },
  hpSep:     { fontSize: FontSize.xl, color: Colors.textDim },
  hpMax:     { fontSize: FontSize.xl, color: Colors.textSecondary },
  hpTemp:    { fontSize: FontSize.sm, color: Colors.blue, alignSelf: 'flex-end' },
  hpBarOuter:{ width: '100%', height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpTapHint: { fontSize: FontSize.xs, color: Colors.textDim },
  dyingTxt:  { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },

  // HP utility row
  hpUtilRow: {
    // wraps: on a 320dp phone (or with a large system font) the temp-HP controls drop to their own line instead of leaving the screen
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
  },
  hpUtilBtn:      { paddingVertical: 4, paddingHorizontal: Spacing.sm },
  hpUtilBtns:     { flexDirection: 'row', gap: Spacing.xs },
  hpUtilTxt:      { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  tempHpControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tempHpLabel:    { fontSize: FontSize.sm, color: Colors.blue, fontWeight: FontWeight.bold },

  // Hit dice
  hitDiceCount: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  useHitDieBtn: {
    backgroundColor: Colors.green + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.green + '66',
    padding: Spacing.sm, alignItems: 'center',
  },
  useHitDieBtnDisabled: { opacity: 0.4 },
  useHitDieTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Weapon attacks
  weaponRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  weaponInfo:   { flex: 1 },
  weaponName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  weaponDamage: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  weaponRight:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weaponBonus:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  weaponBadge: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  weaponBadgeRanged: { backgroundColor: Colors.blue + '22' },
  weaponBadgeTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },

  // Condition warnings
  condMechanicsBlock: { marginTop: 4, gap: 1 },
  condWarning:     { fontSize: FontSize.xs, color: Colors.gold, lineHeight: 16 },
  condWarningName: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'capitalize', color: Colors.textSecondary },
  condAutomated:   { color: Colors.green },
  advList: { marginTop: 4, gap: 2 },
  advTxt:    { color: Colors.green },
  disadvTxt: { color: Colors.red },

  // Number prompt modal input
  numInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, fontSize: FontSize.xl, color: Colors.textPrimary,
    textAlign: 'center', fontWeight: FontWeight.bold,
  },

  // Death saves
  deathSection: {
    backgroundColor: Colors.red + '11', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.red + '44',
    padding: Spacing.md, gap: Spacing.sm,
  },
  deathMsg:   { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  stableMsg:  { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  stabilizedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.green + '22',
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.green,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  stabilizedTxt: { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.sm, letterSpacing: 1 },
  pipRows:    { gap: Spacing.sm },
  pipRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pipLabel:   { fontSize: FontSize.sm, color: Colors.textSecondary, width: 80 },
  pips:       { flexDirection: 'row', gap: Spacing.sm },
  pip: {
    width: 20, height: 20, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  pipSuccess: { backgroundColor: Colors.green, borderColor: Colors.green },
  pipFailure: { backgroundColor: Colors.red,   borderColor: Colors.red },
  deathRollBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  deathRollBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  deathResetBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  deathResetTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  // Death save manual buttons
  deathBtnRow: { flexDirection: 'row', gap: Spacing.xs },
  deathBtn: {
    flex: 1, borderRadius: Radius.md, borderWidth: 1,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  deathBtnFail: { backgroundColor: Colors.red + '22', borderColor: Colors.red + '66' },
  deathBtnFailTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  deathBtnRoll: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  deathBtnRollTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  deathBtnPass: { backgroundColor: Colors.green + '22', borderColor: Colors.green + '66' },
  deathBtnPassTxt: { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  statRow: { flexDirection: 'row', gap: Spacing.sm },
  statBox: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  statBoxOverride: { borderColor: Colors.gold + '66' },

  // Exploration panel
  passiveRow:   { flexDirection: 'row', gap: Spacing.sm },
  passiveBox: {
    flex: 1, backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  passiveValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  passiveLabel: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.5, textAlign: 'center' },
  sensesWrap:   { gap: Spacing.xs, marginTop: Spacing.xs },
  sensesHeading:{ fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1, fontWeight: FontWeight.bold },
  senseChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.blue + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.blue + '55',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  senseChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  senseTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseTypeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  senseTypeChipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  senseTypeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  senseTypeTxtActive: { color: Colors.gold },
  senseInputRow: { flexDirection: 'row', gap: Spacing.sm },

  // Level-up + add-feat row
  levelUpRow:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },
  addFeatBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.md, justifyContent: 'center', alignItems: 'center',
  },
  addFeatTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  statValueRow:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statValue:       { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  overrideStar:    { fontSize: FontSize.xs, color: Colors.gold, alignSelf: 'flex-start', marginTop: 2 },
  statLabel:       { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },

  // Level up
  levelUpBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center',
  },
  levelUpBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  plannerBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  plannerBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  levelUpMcWrap: { gap: Spacing.xs },
  addClassBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    padding: Spacing.sm, alignItems: 'center',
  },
  addClassBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  addClassModalRoot: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.lg },
  addClassHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addClassHeading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold },
  addClassClose: { fontSize: FontSize.xl, color: Colors.textSecondary },
  addClassSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  addClassList: { gap: Spacing.sm, paddingBottom: Spacing.xxl },
  addClassEmpty: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  addClassRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  addClassRowTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  addClassLack: { fontSize: FontSize.sm, color: Colors.red, marginTop: 2 },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionActionBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  sectionActionTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  sectionTitle:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  addBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  addBtnTxt: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  exhaustionBlock: { gap: 4 },
  exhaustionDesc:  { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', paddingLeft: Spacing.sm },

  condRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  condChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.purple + '33', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.purple + '66',
  },
  condChipTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, textTransform: 'capitalize' },
  condX:       { color: Colors.textDim, fontSize: FontSize.sm },
  emptyNote:   { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  endTurnBtn: {
    alignSelf: 'flex-start', marginTop: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  endTurnBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  turnEconomyRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  turnPip: {
    backgroundColor: Colors.green + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.green + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  turnPipUsed: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  turnPipTxt: { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },
  turnPipTxtUsed: { color: Colors.textDim },

  concIndicator: {
    backgroundColor: Colors.blue + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.blue + '44',
    padding: Spacing.sm,
  },
  concIndicatorTxt: { color: Colors.blue, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  concIndicatorRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  concIndicatorLabel: { flex: 1 },
  concEndBtn: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.red + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
  },
  concEndBtnTxt: { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },

  resourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resourceInfo:     { flex: 1 },
  resourceName:     { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  resourceRecharge: { fontSize: FontSize.xs, color: Colors.textDim },
  resourceDesc:     { paddingVertical: Spacing.xs, gap: 4 },
  resourceDescTxt:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  resourceDescName: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resourceControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  resBtn: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  resBtnTxt:     { fontSize: FontSize.lg, color: Colors.textPrimary, lineHeight: 20 },
  resourceCount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 40, textAlign: 'center' },
  resourceMax:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.normal },
  disabled:      { opacity: 0.3 },
  dawnBtn: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginBottom: Spacing.xs },
  dawnBtnTxt: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  rechargeBtn: {
    width: 28, height: 28, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  rechargeBtnTxt: { fontSize: FontSize.md },

  slotGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slotBlock: { alignItems: 'center', gap: 4, minWidth: 50 },
  slotTier:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  slotPips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  pip2: {
    width: 10, height: 10, borderRadius: Radius.full,
    backgroundColor: Colors.blue,
  },
  pip2Used: { backgroundColor: Colors.border },
  slotCount: { fontSize: FontSize.xs, color: Colors.textDim },
  slotCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotRestoreBtn: {
    width: 16, height: 16, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  slotRestoreBtnTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, lineHeight: FontSize.xs },

  // Concentration modal
  backdrop:   { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: Spacing.lg },
  concSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.blue + '44',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  concTitle:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue, textAlign: 'center' },
  concSpell:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  rollBtn:          { backgroundColor: Colors.blue, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  rollBtnTxt:       { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  closeBtnSm:       { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  closeBtnSmTxt:    { color: Colors.textSecondary, fontSize: FontSize.md },
  btnDisabled:      { opacity: 0.4 },
  // Table-first rolled-HP gate (HpRollGate)
  hpRollBackdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: Spacing.lg },
  hpRollSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  hpRollTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  hpRollLine:  { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  hpRollInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
  hpRollInputLabel: { color: Colors.textSecondary, fontSize: FontSize.sm },
  hpRollInput: {
    width: 80, backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.gold, color: Colors.textPrimary,
    textAlign: 'center', paddingVertical: 6, fontSize: FontSize.md,
  },
  hpRollPreview: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.green, textAlign: 'center' },
  hpRollSubmit:    { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  hpRollSubmitTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  hpRollAppBtn:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  hpRollAppBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Condition picker
  condPickerSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, maxHeight: '60%',
  },
  condPickerTitle:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  condSearch: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
  },
  condPickerItem: {
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  condPickerItemTxt: { fontSize: FontSize.md, color: Colors.textPrimary, textTransform: 'capitalize' },
  cancelBtn:         { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:         { color: Colors.textSecondary, fontSize: FontSize.md },

  // Hit dice buttons
  hitDieRow:    { flexDirection: 'row', gap: Spacing.sm },
  hitDieBtn:    { flex: 1, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm, alignItems: 'center' },
  // Table-first: Use Hit Die (manual entry) is the visually primary action;
  // Roll in App (useHitDieTxt below) is the secondary convenience.
  hitDieRoll:   { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  hitDieUse:    { backgroundColor: Colors.green + '22', borderColor: Colors.green + '66' },
  hitDieUseTxt: { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  hitDieEntryRow:       { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  hitDieEntryLabel:     { color: Colors.textSecondary, fontSize: FontSize.sm },
  hitDieEntryInput: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.green, color: Colors.textPrimary,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, fontSize: FontSize.md,
  },
  hitDieEntrySubmit:    { backgroundColor: Colors.green, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  hitDieEntrySubmitTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  hitDieEntryCancel:    { padding: Spacing.sm },
  hitDieEntryCancelTxt: { color: Colors.textDim, fontSize: FontSize.md },
  hitDieHint:   { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', marginTop: 4 },
  // Inline result text (hit die + death saves)
  dieResultTxt: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    color:      Colors.green,
    textAlign:  'center',
    paddingTop: 4,
  },
  // Level-up inline confirm row
  levelUpConfirmRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
    backgroundColor: Colors.gold + '11',
    borderRadius:   Radius.md,
    borderWidth:    1,
    borderColor:    Colors.gold + '66',
    padding:        Spacing.sm,
  },
  levelUpConfirmTxt:    { flex: 1, color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  levelUpConfirmYes: {
    backgroundColor: Colors.gold, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  levelUpConfirmYesTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  levelUpConfirmNo: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  levelUpConfirmNoTxt:   { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // Level-up modal
  lvModalRoot:  { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.xl + 8 },
  lvDone:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.lg },
  lvDoneTxt:    { fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center' },
  lvDoneBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  lvDoneBtnTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
