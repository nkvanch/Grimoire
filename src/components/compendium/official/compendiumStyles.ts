import { StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, Radius, FontWeight } from '../../../theme';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  // The screen title and the Official/Homebrew/Packages switch now live in CompendiumScreen (the shell).
  header: {
    paddingTop: Spacing.xs, paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2 },
  shellHeader: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rulesBtn: { borderWidth: 1, borderColor: Colors.gold + '88', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  rulesBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold },
  shellTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },

  searchWrap: { padding: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.xs },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, color: Colors.textPrimary,
  },
  searchInputFlex: { flex: 1 },

  typeRow: { flexGrow: 0 },
  typeRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  // PERF-SORT-1 (item 3): Filters (start) + Sort (end) share one row.
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs },
  typeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  typeChipActive: { backgroundColor: Colors.blue + '22', borderColor: Colors.blue },
  typeChipTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  typeChipTxtActive: { color: Colors.blue },

  filterPanel: { paddingTop: Spacing.xs, gap: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },

  crRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  crInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.textPrimary, fontSize: FontSize.sm,
  },

  favToggle: {
    alignSelf: 'flex-start', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  favToggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  favToggleTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  favToggleTxtActive: { color: Colors.gold },
  filterHint: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.xs },

  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderLeftWidth: 4, borderColor: Colors.border, padding: Spacing.sm,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, flexWrap: 'wrap' },
  rowName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowSummary: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  typeBadge: {
    backgroundColor: Colors.blue + '22', borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.blue + '66', paddingHorizontal: 6, paddingVertical: 1,
  },
  typeBadgeTxt: { fontSize: 10, color: Colors.blue, fontWeight: FontWeight.bold },
  provBadge: { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  provBadgeOfficial: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.border },
  provBadgeHomebrew: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  provBadgeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  starTxt: { fontSize: FontSize.lg },

  rowDetail: { marginTop: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, gap: 4 },
  rowDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  featureList: { gap: 2, marginTop: 2 },
  featureTxt:  { fontSize: FontSize.xs, color: Colors.textDim },
});
