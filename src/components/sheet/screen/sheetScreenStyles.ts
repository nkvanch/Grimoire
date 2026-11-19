import { StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, FontWeight, Radius } from '../../../theme';

// ── Styles ────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },

  header: {
    backgroundColor:   Colors.surfaceHigh,
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap:               Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
  },
  headerStats: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingLeft:    2,
  },
  backBtn:  { paddingRight: Spacing.xs },
  backTxt:  { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  charNameBtn: { flex: 1, flexShrink: 1, minHeight: 44, justifyContent: 'center' },
  charName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  freeEditBtn: {
    flexShrink: 0,
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3, marginRight: Spacing.xs,
  },
  freeEditTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  headerIconBtn:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:Radius.full},
  headerIcon:{fontSize:20,color:Colors.gold,fontWeight:FontWeight.bold},
  menuBackdrop:{flex:1,backgroundColor:'#00000088',alignItems:'flex-end',paddingTop:56,paddingRight:Spacing.md},
  headerMenu:{width:220,backgroundColor:Colors.surfaceHigh,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border,padding:Spacing.xs},
  menuItem:{minHeight:44,flexDirection:'row',alignItems:'center',gap:Spacing.md,paddingHorizontal:Spacing.md,borderRadius:Radius.sm},
  menuItemDisabled:{opacity:0.45},menuIcon:{fontSize:18,width:24,textAlign:'center'},menuLabel:{fontSize:FontSize.sm,color:Colors.textPrimary,fontWeight:FontWeight.bold},
  undoRedoTxtDisabled: { color: Colors.textDim },
  charSub:  { fontSize: FontSize.xs, color: Colors.textSecondary },
  charSubBtn: { minHeight: 44, justifyContent: 'center' },

  statPills: { flexDirection: 'row', gap: Spacing.xs },
  statPill: {
    backgroundColor:  Colors.surface,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  3,
    alignItems:       'center',
    minWidth:         44,
  },
  statPillValue: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    color:      Colors.textPrimary,
    lineHeight: 20,
  },
  statPillMax:  { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.normal },
  statPillLabel:{ fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 14 },

  tabBarScroll: {
    backgroundColor:   Colors.surfaceHigh,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexGrow:          0,
  },
  tabBarContent: {
    flexDirection: 'row',
    minWidth:      '100%',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,   // neighbouring labels ("Abilities" / "Features") never touch on a narrow phone
    alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:  { borderBottomColor: Colors.gold },
  tabTxt:        { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  tabTxtActive:  { color: Colors.gold },
  tabLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeTxt: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.bg },

  tabContent: { flex: 1 },
  widePanes: { flex: 1, flexDirection: 'row' },
  widePaneLeft: { flex: 5, borderRightWidth: 1, borderRightColor: Colors.border },
  widePaneRight: { flex: 7 },

  modeSwitch: {
    flexDirection: 'row', gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  modeBtn: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  modeBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  modeTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  modeTxtActive: { color: Colors.gold },

  persistErrorBanner: {
    paddingVertical: 6, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.red + '22',
    borderBottomWidth: 1, borderBottomColor: Colors.red + '66',
  },
  persistErrorTxt: { fontSize: FontSize.xs, color: Colors.red },

  restBar: {
    flexDirection:   'row',
    gap:             Spacing.sm,
    padding:         Spacing.sm,
    backgroundColor: Colors.surfaceHigh,
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
  },
  restBtn: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  restBtnLong: { borderColor: Colors.blue + '88' },
  restBtnTxt:  { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  restBtnSub:  { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 1 },
});
