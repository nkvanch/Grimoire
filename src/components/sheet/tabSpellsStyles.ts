import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontWeight, FontSize } from '../../theme';

// ── Styles ────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  addSpellBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66', borderStyle: 'dashed',
    padding: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm,
  },
  addSpellBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  endTurnBtn: {
    alignSelf: 'flex-start', marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  endTurnBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  modalBackdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl, maxHeight: '90%',
  },
  modalTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSearch: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  modalGroup:      { marginBottom: Spacing.sm },
  modalGroupLabel: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, fontWeight: FontWeight.bold, marginBottom: Spacing.xs },
  modalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalRowName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  modalRowMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  modalAdd:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  modalRemove:  { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },
  modalEmpty:   { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  modalClose:   { alignItems: 'center', padding: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md },
  modalCloseTxt:{ color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  // Concentration
  concBanner: {
    backgroundColor: Colors.blue + '22',
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.blue + '66',
    padding:         Spacing.sm,
    marginBottom:    Spacing.xs,
  },
  concBannerTxt: {
    color:      Colors.blue,
    fontWeight: FontWeight.bold,
    fontSize:   FontSize.sm,
    textAlign:  'center',
  },
  concBannerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  concBannerLabel: { flex: 1, textAlign: 'left' },
  concEndBtn: {
    backgroundColor:   Colors.red + '22',
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       Colors.red + '66',
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.xs,
  },
  concEndBtnTxt: { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },

  // Per-level slot pools (ordinary + pact), each with its restore button
  slotPools: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  slotPool:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  slotRestoreBtn: {
    width: 22, height: 22, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.blue + '66',
    alignItems: 'center', justifyContent: 'center',
  },
  slotRestoreBtnDisabled:    { borderColor: Colors.border, opacity: 0.5 },
  slotRestoreBtnTxt:         { fontSize: FontSize.sm, color: Colors.blue, fontWeight: FontWeight.bold, lineHeight: FontSize.sm + 2 },
  slotRestoreBtnTxtDisabled: { color: Colors.textDim },

  // Ritual cast — gold, to match the "Ritual" tag and stay clearly distinct
  // from the blue slot-spending Cast button beside it.
  ritualBtn: {
    backgroundColor:   Colors.gold + '22',
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       Colors.gold + '88',
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.xs,
    alignItems:        'center',
  },
  ritualBtnTxt: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },

  // Empty
  empty:      { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyIcon:  { fontSize: 48 },
  emptyTxt:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptySubTxt:{ fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // Level section
  levelSection: { gap: Spacing.xs },
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionTitle: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.bold,
    color:         Colors.textSecondary,
    letterSpacing: 2,
  },

  // Slot badge
  slotBadge: {
    backgroundColor:  Colors.blue + '22',
    borderRadius:     Radius.full,
    borderWidth:      1,
    borderColor:      Colors.blue + '66',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  2,
  },
  slotBadgeEmpty: {
    backgroundColor: Colors.border,
    borderColor:     Colors.border,
  },
  slotBadgeTxt: {
    fontSize:   FontSize.xs,
    color:      Colors.blue,
    fontWeight: FontWeight.bold,
  },
  slotBadgeTxtEmpty: { color: Colors.textDim },

  // Spell card
  spellCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },
  spellCardUnavail: { opacity: 0.6 },

  spellRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       Spacing.sm,
    gap:           Spacing.sm,
  },

  // Left body (tap to expand)
  spellBody: { flex: 1, gap: 3 },
  spellNameLine: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  spellName: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    color:      Colors.textPrimary,
    flexShrink: 1,
  },
  spellNameDim: { color: Colors.textDim },
  spellTags: { flexDirection: 'row', gap: 4 },
  tagConc: {
    backgroundColor: Colors.blue + '22',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.blue + '66',
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tagConcTxt:  { fontSize: 9, color: Colors.blue, fontWeight: FontWeight.bold },
  tagRitual: {
    backgroundColor: Colors.gold + '22',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.gold + '66',
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tagRitualTxt:{ fontSize: 9, color: Colors.gold, fontWeight: FontWeight.bold },
  tagUnprepared: {
    backgroundColor: Colors.textDim + '22',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.textDim + '66',
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tagUnpreparedTxt: { fontSize: 9, color: Colors.textDim, fontWeight: FontWeight.bold },
  expandCaret: { fontSize: 9, color: Colors.textDim, marginLeft: 'auto' },
  spellMeta:   { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Right actions
  spellActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  // Prepared toggle
  prepBtn: {
    width:           28,
    height:          28,
    borderRadius:    Radius.full,
    borderWidth:     1,
    borderColor:     Colors.border,
    backgroundColor: Colors.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  prepBtnActive: {
    borderColor:     Colors.green + '88',
    backgroundColor: Colors.green + '22',
  },
  prepBtnTxt:        { fontSize: FontSize.sm, color: Colors.textDim },
  prepBtnTxtActive:  { color: Colors.green, fontWeight: FontWeight.bold },

  // Cast button
  castBtn: {
    backgroundColor:  Colors.blue + '22',
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.blue + '66',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Spacing.xs,
    minWidth:         44,
    alignItems:       'center',
  },
  castBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
    borderColor:     Colors.border,
  },
  castBtnTxt:         { fontSize: FontSize.sm, color: Colors.blue, fontWeight: FontWeight.bold },
  castBtnTxtDisabled: { color: Colors.textDim },

  // Expanded details
  details: {
    paddingHorizontal: Spacing.sm,
    paddingBottom:     Spacing.sm,
    paddingTop:        2,
    gap:               Spacing.xs,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
    marginBottom:  Spacing.xs,
  },
  detailCell: {
    backgroundColor:  Colors.surfaceHigh,
    borderRadius:     Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },
  detailCellLabel: {
    fontSize:      FontSize.xs,
    color:         Colors.textDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailCellValue: {
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  detailEffect: {
    fontSize:   FontSize.sm,
    color:      Colors.gold,
    fontWeight: FontWeight.bold,
  },
  detailSave: {
    fontSize: FontSize.xs,
    color:    Colors.textSecondary,
  },
  detailDesc: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 18,
  },
  upcastBlock: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold + '66',
    padding:         Spacing.sm,
    gap:             2,
  },
  upcastLabel: {
    fontSize:   FontSize.xs,
    color:      Colors.gold,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  upcastDesc: {
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    lineHeight: 16,
  },
  unavailNote: {
    fontSize:   FontSize.xs,
    color:      Colors.red,
    fontStyle:  'italic',
  },
});
