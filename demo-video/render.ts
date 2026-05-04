import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'path';

const run = async () => {
  const composition = await selectComposition({
    serveUrl: path.resolve(process.cwd(), 'src/index.ts'),
    id: 'NodiDemo',
  });

  await renderMedia({
    composition,
    serveUrl: path.resolve(process.cwd(), 'src/index.ts'),
    codec: 'h264',
    outputLocation: 'out/nodi-demo.mp4',
  });

  console.log('Video rendered successfully!');
};

run().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
