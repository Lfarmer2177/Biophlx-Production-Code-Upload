import React, {useEffect, useRef, useState} from 'react';
import {Alert, ScrollView, Text, TextInput, View, Pressable} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';
import {usePreventRemove} from '@react-navigation/native';
import {useBle} from '../context/BleContext';
import {useBIOPHLXTheme} from '../Theme/BIOPHLXTheme';
import {OTA_PILOT_ENABLED} from '../config/appVariant';
import {validateFirmwareArtifact, OTA_SLOT_SIZE} from '../services/otaArtifact';
import {base64ToBytes} from '../services/ota/protocol';

export default function FirmwareUpdateScreen({route, navigation}) {
  const slot = route.params?.slot === 'secondary' ? 'secondary' : 'primary';
  const {colors} = useBIOPHLXTheme();
  const {connectedDevice, secondaryDevice, firmwareInfo, refreshFirmwareInfo,
    otaState, startFirmwareUpdate, cancelFirmwareUpdate, batteryLevels} = useBle();
  const device = slot === 'primary' ? connectedDevice : secondaryDevice;
  const info = firmwareInfo[slot];
  const [target, setTarget] = useState('');
  const [expectedMd5, setExpectedMd5] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const working = useRef(false);
  const mounted = useRef(true);
  const state = otaState.slot === slot ? otaState : {phase:'idle',progress:0};
  useEffect(() => { mounted.current=true; refreshFirmwareInfo(slot).catch(e=>{if(mounted.current)setError(e.message);}); return () => {mounted.current=false;}; }, [slot]);
  usePreventRemove(busy, () => {
    Alert.alert('Update in progress', state.cancellable ? 'Cancel the update before leaving this screen.' : 'Keep this screen open while the band finishes and reconnects.');
  });
  const card = {backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:16,padding:18,gap:12,marginBottom:16};
  const text = {color:colors.text,fontSize:16};
  const input = {...text,borderWidth:1,borderColor:colors.border,borderRadius:9,padding:12};
  const button = (label, action, disabled=false) => <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{backgroundColor:disabled?colors.raised:colors.primary,padding:15,borderRadius:10}}><Text style={{color:disabled?colors.muted:colors.onPrimary,textAlign:'center',fontWeight:'700'}}>{label}</Text></Pressable>;
  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true});
      if (result.canceled) return;
      const selected = result.assets[0];
      const stat = await FileSystem.getInfoAsync(selected.uri);
      if (!stat.exists || !Number.isFinite(stat.size) || stat.size <= 0 || stat.size > OTA_SLOT_SIZE) throw new Error('Choose a non-empty firmware .gz file smaller than the update slot.');
      setFile({...selected,size:stat.size});setError('');
    } catch(e) {setError(e.message);}
  };
  const run = async () => {
    if (working.current) return;
    working.current=true;setBusy(true);setError('');
    try {
      await activateKeepAwakeAsync('biophlx-ota');
      const latest = await refreshFirmwareInfo(slot);
      if (!latest?.supportsOta) throw new Error('This firmware needs a USB/service upgrade before wireless updates.');
      const encoded = await FileSystem.readAsStringAsync(file.uri,{encoding:FileSystem.EncodingType.Base64});
      const artifact = await validateFirmwareArtifact(base64ToBytes(encoded),{targetVersion:target.trim(),hardware:latest.hardware,currentVersion:latest.version,expectedImageMd5:expectedMd5.trim()});
      await startFirmwareUpdate(slot,artifact);
    } catch(e) {if(mounted.current)setError(e.message);}
    finally {working.current=false;if(mounted.current)setBusy(false);deactivateKeepAwake('biophlx-ota');}
  };
  const confirm = () => Alert.alert('Install the selected release?', 'This pilot uses unsigned firmware. Verify the file, hardware target and image MD5 with the release engineer. Keep the app open and do not press the band button.',[{text:'Back',style:'cancel'},{text:'Start update',onPress:run}]);
  return <ScrollView contentContainerStyle={{padding:20,backgroundColor:colors.background}}>
    <View style={card}><Text style={{...text,fontSize:24,fontWeight:'700'}}>Band firmware</Text><Text style={text}>{slot === 'primary' ? 'Band 1' : 'Band 2'} - {device?.name || 'Disconnected'}</Text><Text style={text}>Installed: {info?.version || 'Unavailable'}</Text><Text style={text}>Hardware: {info?.hardware || 'Unavailable'} | Battery: {batteryLevels[slot] ?? '--'}%</Text><Text style={{color:colors.muted}}>Updates run one band at a time, after your workout. Your phone sends the file over Bluetooth.</Text></View>
    {!OTA_PILOT_ENABLED && <View style={card}><Text style={text}>Internal pilot only</Text><Text style={{color:colors.muted}}>Customer updating is disabled until firmware security, recovery and physical-device checks are complete.</Text></View>}
    {info && !info.supportsOta && <View style={card}><Text style={text}>Service update required</Text><Text style={{color:colors.muted}}>Firmware older than 1.3.11 needs a USB update by the support team first.</Text></View>}
    <View style={card}><Text style={{...text,fontWeight:'700'}}>Release file</Text><Text style={{color:colors.muted}}>Use the release engineer's .gz file, target version and uncompressed image MD5. These integrity checks do not prove who signed the firmware.</Text>
      <Text style={text}>Target release</Text><TextInput accessibilityLabel="Target firmware version" style={input} value={target} onChangeText={setTarget} editable={!busy} placeholder="1.3.12" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false}/>
      <Text style={text}>Image MD5 supplied with release</Text><TextInput accessibilityLabel="Expected image MD5" style={input} value={expectedMd5} onChangeText={setExpectedMd5} editable={!busy} autoCapitalize="none" autoCorrect={false} maxLength={32}/>
      {button(file?`Selected: ${file.name}`:'Choose firmware.bin.gz',pick,busy || !OTA_PILOT_ENABLED)}
      <Text style={{color:colors.muted}}>Keep both bands idle. Charge to at least 10% for this pilot. Keep the phone nearby and this screen open; do not press the device button.</Text>
      {button('Start update',confirm,busy || !OTA_PILOT_ENABLED || !device || !info?.supportsOta || !file || !target || expectedMd5.length!==32)}
    </View>
    <View style={card}><Text accessibilityLiveRegion="polite" style={{...text,fontWeight:'700'}}>{busy?'Update in progress':state.phase === 'complete'?'Installed version verified':'Update status'}: {state.phase}</Text>
      <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round((state.progress||0)*100)}} style={{height:12,borderRadius:6,backgroundColor:colors.raised}}><View style={{height:12,borderRadius:6,width:`${Math.round((state.progress||0)*100)}%`,backgroundColor:colors.primary}}/></View>
      <Text style={text}>{state.message || 'Select a verified release file to begin.'}</Text>
      {!!error && <Text accessibilityLiveRegion="polite" style={{color:colors.accent}}>{error}</Text>}
      {busy && button('Cancel update',()=>{if(!cancelFirmwareUpdate())Alert.alert('Finishing update','The band is verifying or restarting. Wait for the outcome.');},!state.cancellable)}
      {!busy && state.phase==='complete' && button('Back to bands',()=>navigation.goBack())}
    </View>
  </ScrollView>;
}
