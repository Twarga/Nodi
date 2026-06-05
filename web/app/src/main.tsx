import { render } from 'preact';
import { App } from './App';
import './index.css';

render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works normally if service workers are unavailable.
    });
  });
}
