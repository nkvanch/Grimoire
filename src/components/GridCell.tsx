// ============================================================================
// FILE: src/components/GridCell.tsx
// Multi-column FlatLists for the wide layout (platform/layout.ts). With one column everything is exactly as it was: no wrapper, no
// extra props. With more, each item is a cell of equal width and a short last row does not stretch.
// ============================================================================
import React from 'react';
import { View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';

/** Props to spread on a FlatList. `key` must change with the column count (React Native cannot change numColumns in place). */
export function gridProps(columns: number): { key: string; numColumns: number; columnWrapperStyle?: { gap: number } } {
  return {
    key: `cols-${columns}`,
    numColumns: columns,
    ...(columns > 1 ? { columnWrapperStyle: { gap: 12 } } : {}),
  };
}

export function GridCell({ columns, children }: { columns: number; children: React.ReactNode }) {
  if (columns <= 1) return <>{children}</>;
  return <View style={{ flex: 1, maxWidth: `${100 / columns}%` }}>{children}</View>;
}

/** Wraps a renderItem so each item sits in a grid cell. A no-op for one column. */
export function withGridCell<T>(columns: number, render: (info: ListRenderItemInfo<T>) => React.ReactElement | null) {
  if (columns <= 1) return render;
  return (info: ListRenderItemInfo<T>) => <GridCell columns={columns}>{render(info)}</GridCell>;
}
