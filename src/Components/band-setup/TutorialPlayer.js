import React from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
export default function TutorialPlayer() {
  const player = useVideoPlayer(require('../../../assets/tutorial/band-placement.mp4'));
  return <VideoView player={player} style={{width:'100%',height:260}} nativeControls allowsFullscreen contentFit="contain" />;
}
