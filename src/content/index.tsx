import { createRoot } from 'react-dom/client';
import { Panel } from './components/Panel';
import css from './panel.css?inline';
import { loadCachedSelectors } from './selectors';

function mount() {
  const host = document.createElement('div');
  host.id = 'leet-buddy-host';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  createRoot(mountPoint).render(<Panel />);
}

if (location.pathname.startsWith('/problems/')) {
  // wait a tick for LeetCode SPA to settle
  void loadCachedSelectors();
  setTimeout(mount, 800);
}
