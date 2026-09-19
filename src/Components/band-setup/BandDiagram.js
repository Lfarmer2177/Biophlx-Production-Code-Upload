import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path, Rect, G, Text as Label } from 'react-native-svg';

export default function BandDiagram({ placement, side = 'right' }) {
  const arm = (x, label) => <G key={label}><Rect x={x} y="105" width="34" height="17" rx="5" fill="#152c3b"/><Rect x={x + 9} y="103" width="16" height="21" rx="4" fill="#0c9e97"/><Label x={x+17} y="118" textAnchor="middle" fill="white" fontSize="11">{label}</Label></G>;
  const leg = (x, label) => <G key={label}><Rect x={x} y="232" width="41" height="19" rx="5" fill="#152c3b"/><Rect x={x+12} y="230" width="17" height="23" rx="4" fill="#0c9e97"/><Label x={x+20} y="246" textAnchor="middle" fill="white" fontSize="11">{label}</Label></G>;
  return <View accessible accessibilityLabel={`Front view: ${placement === 'arms' ? 'one band on each biceps' : placement === 'legs' ? 'one band on each thigh, sensors facing forward' : `band 1 on ${side} thigh, band 2 on ${side} biceps`}`} style={{alignItems:'center', backgroundColor:'#eef7f6', borderRadius:16, marginVertical:12}}>
    <Svg width="250" height="310" viewBox="0 0 260 340">
      <Circle cx="130" cy="34" r="24" fill="#cba084"/>
      <Path d="M105 63 Q130 76 155 63 L176 83 L193 171 Q190 183 180 174 L158 109 L157 199 L103 199 L102 109 L80 174 Q68 185 67 171 L84 83 Z" fill="#708da0"/>
      <Path d="M103 196 L157 196 L169 262 L140 264 L130 221 L120 264 L91 262 Z" fill="#283f50"/>
      <Path d="M93 263 L119 263 L115 316 L90 316 Z M141 263 L167 263 L170 316 L145 316 Z" fill="#cba084"/>
      {placement === 'arms' && <>{arm(76,'2')}{arm(150,'1')}</>}
      {placement === 'legs' && <>{leg(92,'2')}{leg(132,'1')}</>}
      {placement === 'combined' && <>{leg(side === 'right' ? 92 : 132,'1')}{arm(side === 'right' ? 76 : 150,'2')}</>}
      <Label x="130" y="335" textAnchor="middle" fill="#385667" fontSize="12">FRONT VIEW · SENSOR FACES YOU</Label>
    </Svg>
    <Text style={{color:'#385667',paddingBottom:10}}>Numbers identify your two bands.</Text>
  </View>;
}
