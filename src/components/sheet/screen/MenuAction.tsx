import { Text } from 'react-native';
import { Pressable } from '../../AccessibleControls';
import { styles } from './sheetScreenStyles';

export function MenuAction({icon,label,onPress,disabled=false}:{icon:string;label:string;onPress:()=>void;disabled?:boolean}){return <Pressable testID={`character-menu-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} accessibilityRole="menuitem" accessibilityLabel={label} disabled={disabled} style={[styles.menuItem,disabled&&styles.menuItemDisabled]} onPress={onPress}><Text style={styles.menuIcon}>{icon}</Text><Text style={styles.menuLabel}>{label}</Text></Pressable>}
