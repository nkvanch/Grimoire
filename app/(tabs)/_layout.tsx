// app/(tabs)/_layout.tsx
// Bottom tab navigator — 5 sections: Home, Campaigns, Characters, Homebrew, Compendium.
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize } from '../../src/theme';
import { useLayout, SIDEBAR_WIDTH } from '../../src/platform/layout';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconActive]}>{glyph}</Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();
  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        // A wide window gets a navigation bar down the left side; a phone keeps the bar along the bottom.
        tabBarPosition:       isWide ? 'left' : 'bottom',
        tabBarLabelPosition:  isWide ? 'beside-icon' : undefined,
        tabBarStyle:          isWide
          ? styles.sidebar
          : {
              ...styles.bar,
              paddingBottom: insets.bottom || 8,
              height:        60 + (insets.bottom || 0),
            },
        tabBarItemStyle:      isWide ? styles.sidebarItem : undefined,
        tabBarActiveBackgroundColor:   isWide ? Colors.gold + '22' : undefined,
        tabBarInactiveBackgroundColor: isWide ? 'transparent' : undefined,
        tabBarActiveTintColor:   Colors.gold,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarLabelStyle:     isWide ? styles.sidebarLabel : styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚔️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campaigns',
          tabBarButtonTestID: 'tab-campaigns',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🗺️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="characters"
        options={{
          title: 'Characters',
          tabBarButtonTestID: 'tab-characters',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="homebrew"
        options={{
          title: 'Homebrew',
          tabBarButtonTestID: 'tab-homebrew',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📜" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compendium"
        options={{
          title: 'Compendium',
          tabBarButtonTestID: 'tab-compendium',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📖" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surfaceHigh,
    borderTopColor:  Colors.border,
    borderTopWidth:  1,
    height:          60,
    paddingBottom:   8,
  },
  label: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
  },
  sidebar: {
    width:             SIDEBAR_WIDTH,
    // the navigation library sets a minimum that grows with the window; pin both so the bar stays a bar
    minWidth:          SIDEBAR_WIDTH,
    maxWidth:          SIDEBAR_WIDTH,
    backgroundColor:   Colors.surfaceHigh,
    borderColor:       Colors.border,
    borderRightColor:  Colors.border,
    borderRightWidth:  1,
    borderTopWidth:    0,
    paddingTop:        16,
    paddingHorizontal: 8,
  },
  sidebarItem: {
    borderRadius:      10,
    paddingVertical:   10,
    paddingHorizontal: 12,
    marginBottom:      4,
    justifyContent:    'flex-start',
  },
  sidebarLabel: {
    fontSize:   FontSize.md,
    fontWeight: '600',
    marginLeft: 10,
  },
  icon: {
    fontSize:   22,
    opacity:    0.5,
  },
  iconActive: {
    opacity: 1,
  },
});
