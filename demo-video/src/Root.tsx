import {Composition} from 'remotion';
import {NodiDemo} from './NodiDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NodiDemo"
      component={NodiDemo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
