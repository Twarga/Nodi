import React from 'react';
import {Sequence} from 'remotion';
import {IntroScene} from './scenes/IntroScene';
import {FeaturesScene} from './scenes/FeaturesScene';
import {InstallScene} from './scenes/InstallScene';
import {OutroScene} from './scenes/OutroScene';

export const NodiDemo: React.FC = () => {
  return (
    <>
      <Sequence from={0} durationInFrames={210}>
        <IntroScene />
      </Sequence>
      <Sequence from={180} durationInFrames={300}>
        <FeaturesScene />
      </Sequence>
      <Sequence from={450} durationInFrames={270}>
        <InstallScene />
      </Sequence>
      <Sequence from={690} durationInFrames={210}>
        <OutroScene />
      </Sequence>
    </>
  );
};
