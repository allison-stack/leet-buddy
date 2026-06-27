import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Leet Buddy',
  version: '0.1.0',
  description: 'Keeps you from giving up too early or spending forever on LeetCode problems.',
  icons: {
    '16': 'public/icons/16.png',
    '32': 'public/icons/32.png',
    '48': 'public/icons/48.png',
    '128': 'public/icons/128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: 'public/icons/32.png',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://leetcode.com/problems/*'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'alarms', 'notifications', 'tabs'],
  host_permissions: [
    'https://leetcode.com/*',
    'https://api.groq.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://api.anthropic.com/*',
    'https://api.openai.com/*',
    'https://*.supabase.co/*',
  ],
});
