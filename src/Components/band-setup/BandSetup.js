import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable } from 'react-native';
import BandDiagram from './BandDiagram';
import TutorialPlayer from './TutorialPlayer';
import { placementCopy } from './placement';

const baseStyles = {
  overlay:{flex:1,backgroundColor:'#102c38bb',alignItems:'center',justifyContent:'center',padding:16},
  card:{backgroundColor:'white',borderRadius:22,width:'100%',maxWidth:440,maxHeight:'95%',padding:22},
  title:{fontSize:24,fontWeight:'700',color:'#153849',marginBottom:8},
  text:{fontSize:16,lineHeight:24,color:'#385667',marginVertical:6},
  button:{backgroundColor:'#087f7a',padding:15,borderRadius:12,alignItems:'center',marginTop:12},
};
export function SetupButton({title,onPress,disabled=false,variant="primary"}) {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={brandTheme.style([styles.button,{backgroundColor:variant === 'secondary' ? brandTheme.colors.raised : brandTheme.colors.primary},disabled && {opacity:0.45}])}><Text style={[{color:brandTheme.colors.text}, brandTheme.style({color:variant === 'secondary' ? brandTheme.colors.text : brandTheme.colors.onPrimary,fontWeight:'700',fontSize:16})]}>{title}</Text></Pressable>; }
export function DeviceInstructions() {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);
 return <View><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>1. Connect both bands and select your exercise.</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>2. Confirm placement, hold still and wait for the countdown to reach zero. Begin when your band buzzes.</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>3. Press the center button beneath the light once to pause. Press again to begin the next set with new reps.</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>4. Hold the center button for 3 seconds to end the workout.</Text></View>; }
export function TutorialModal({visible,onClose}) {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);
 if (!visible) return null; return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={brandTheme.style(styles.overlay)}><View style={brandTheme.style(styles.card)}><ScrollView><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>Your first workout starts here</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Watch how to fit your bands</Text><TutorialPlayer/><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>Connect and begin</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Turn on both bands using their power button. A blinking blue light means they are waiting to connect. Select the bands inside the app.</Text><DeviceInstructions/><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>What the lights mean</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Blinking blue: waiting to connect.{ '\n' }Green / orange: connected band 1 / band 2.{ '\n' }White: exercise active.{ '\n' }Red while exercising: paused.{ '\n' }Blinking red while disconnected: battery below 25%.{ '\n' }While charging: red means charging, green means full.</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Disconnect the charging cable before exercising.</Text><SetupButton title="Done" onPress={onClose}/></ScrollView></View></View></Modal>; }
export function TutorialCard() {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);
 const [visible,setVisible]=useState(false); return <View style={brandTheme.style({padding:18,backgroundColor:'#eaf6f4',borderRadius:18,marginVertical:14})}><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>New to your bands?</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Watch the placement tutorial, learn the lights, and prepare for your first exercise.</Text><SetupButton title="Band setup & help · Watch tutorial" onPress={()=>setVisible(true)}/><TutorialModal visible={visible} onClose={()=>setVisible(false)}/></View>; }
export function PlacementModal({visible,exercise,placement,side,onSideChange,connected,onConfirm,onClose,busy=false,error=''}) {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);

  const [tutorial,setTutorial]=useState(false);
  return <><Modal visible={visible && !tutorial} transparent animationType="fade" onRequestClose={onClose}><View style={brandTheme.style(styles.overlay)}><View style={brandTheme.style(styles.card)}><ScrollView><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>Place your bands</Text><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>{exercise}</Text>{placement ? <><BandDiagram placement={placement} side={side}/><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>{placementCopy[placement]}</Text>{placement==='combined' && <View style={brandTheme.style({flexDirection:'row',justifyContent:'space-around'})}>{['left','right'].map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:side===value}} onPress={()=>onSideChange(value)} style={brandTheme.style({padding:12,backgroundColor:side===value?'#d1eeea':'#f3f5f7',borderRadius:8})}><Text style={{color:brandTheme.colors.text}}>{value === 'left' ? 'Left arm + thigh' : 'Right arm + thigh'}</Text></Pressable>)}</View>}</> : <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Placement is not configured for this exercise. Choose a supported exercise before starting.</Text>}<SetupButton variant="secondary" title="Watch placement tutorial" onPress={()=>setTutorial(true)}/><Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Next: hold still. Wait for zero and the band’s buzz before you begin.</Text>{!connected && <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.text)]}>Waiting for both bands to connect.</Text>}{!!error && <Text accessibilityRole="alert" style={[{color:brandTheme.colors.text}, brandTheme.style({color:'#a62431'})]}>{error}</Text>}<SetupButton title={busy?'Preparing bands…':'OK, bands are in place'} disabled={!connected || !placement || busy} onPress={onConfirm}/><SetupButton variant="secondary" title="Cancel" disabled={busy} onPress={onClose}/></ScrollView></View></View></Modal><TutorialModal visible={visible && tutorial} onClose={()=>setTutorial(false)}/></>;
}
