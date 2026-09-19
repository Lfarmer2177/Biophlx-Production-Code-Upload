import React from 'react';
import { Image, View, Text } from 'react-native';
import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';

// Photos extracted from the user-supplied BIOPHLX-Light-and-Dark.pdf.
// Static requires allow Metro to package every asset for offline use.
const photos = {
  light: {
    arms: require('../../../assets/band-placement/arms-light.png'),
    legs: require('../../../assets/band-placement/legs-light.png'),
    combined: require('../../../assets/band-placement/combined-light.png'),
  },
  dark: {
    arms: require('../../../assets/band-placement/arms-dark.png'),
    legs: require('../../../assets/band-placement/legs-dark.png'),
    combined: require('../../../assets/band-placement/combined-dark.png'),
  },
};

export default function BandDiagram({ placement, side = 'right' }) {
  const { colors, dark } = useBIOPHLXTheme();
  const source = photos[dark ? 'dark' : 'light'][placement];
  if (!source) return null;
  const chosenSide = side === 'left' ? 'Left' : 'Right';
  const labels = placement === 'combined'
    ? [`Band 1: ${chosenSide.toLowerCase()} thigh`, `Band 2: ${chosenSide.toLowerCase()} upper arm`]
    : [`Band 1: left ${placement === 'arms' ? 'upper arm' : 'thigh'}`, `Band 2: right ${placement === 'arms' ? 'upper arm' : 'thigh'}`];
  const mirrored = placement === 'combined' && side === 'left';
  return <View style={{ marginVertical:12, borderRadius:16, overflow:'hidden', backgroundColor:colors.surface }}>
    <Image source={source} resizeMode="contain" accessible accessibilityRole="image"
      accessibilityLabel={`Front view. ${labels.join('. ')}. Sensors face forward.`}
      style={{width:'100%',height:340,transform:mirrored ? [{scaleX:-1}] : []}} />
    <View style={{padding:12,gap:6}}>
      <Text style={{color:colors.text,fontSize:15,fontWeight:'700'}}>Sensors face forward</Text>
      {labels.map(label=><Text key={label} style={{color:colors.muted,fontSize:14}}>{label}</Text>)}
      <Text style={{color:colors.muted,fontSize:12}}>Left and right refer to your body.{mirrored ? ' Photo mirrored for left-side placement.' : ''}</Text>
    </View>
  </View>;
}
