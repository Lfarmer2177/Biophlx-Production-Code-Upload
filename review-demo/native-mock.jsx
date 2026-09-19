import React from 'react';
import {View,Text} from 'react-native';
export const SafeAreaView=View;
export const useSafeAreaInsets=()=>({top:0,right:0,bottom:0,left:0});
export const useNavigation=()=>window.demoNavigation;
export const Ionicons=({name,size=20,color})=><Text style={{fontSize:size,color}}>{name.includes('person')?'●':name.includes('chevron')?'›':'○'}</Text>;
export const FontAwesome5=Ionicons;
export const requestMediaLibraryPermissionsAsync=async()=>({granted:false});
export const launchImageLibraryAsync=async()=>({canceled:true});
export const MediaTypeOptions={Images:'Images'};
export default function Empty(){return null;}
