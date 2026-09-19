import React from 'react';
import { Pressable, Text } from 'react-native';
import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';

export default function BrandButton({ title, onPress, disabled, accessibilityLabel, testID, variant = 'primary' }) {
  const { colors } = useBIOPHLXTheme();
  const secondary = variant === 'secondary';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title}
    accessibilityState={{ disabled: !!disabled }} disabled={disabled} testID={testID} onPress={onPress}
    style={({pressed}) => ({ minHeight:48, minWidth:140, paddingHorizontal:18, paddingVertical:14,
      alignItems:'center', justifyContent:'center', alignSelf:'stretch', borderRadius:12,
      backgroundColor:secondary ? colors.raised : colors.primary, opacity: disabled ? .45 : pressed ? .8 : 1 })}>
    <Text style={{color:secondary ? colors.text : colors.onPrimary,fontSize:15,fontWeight:'700'}}>{title}</Text>
  </Pressable>;
}
