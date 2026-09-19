import React from 'react';
export default function TutorialPlayer() {
  return <video aria-label="How to put on your bands" controls playsInline preload="metadata" style={{width:'100%',maxHeight:320,background:'#102c38'}} src={require('../../../assets/tutorial/band-placement.mp4')} />;
}
