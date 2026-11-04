const fs = require('fs');
const path = require('path');

const routes = [
  { name: 'Contacts', path: 'src/app/contacts/page.tsx', route: '/contacts', category: 'MAIN' },
  { name: 'Inbox', path: 'src/app/inbox/page.tsx', route: '/inbox', category: 'MAIN' },
  { name: 'Broadcasts', path: 'src/app/broadcasts/page.tsx', route: '/broadcasts', category: 'MAIN' },
  { name: 'Schedule', path: 'src/app/schedule/page.tsx', route: '/schedule', category: 'MAIN' },
  { name: 'Whatsapp Templates', path: 'src/app/templates/page.tsx', route: '/templates', category: 'WHATSAPP' },
  { name: 'Whatsapp Forms', path: 'src/app/forms/page.tsx', route: '/forms', category: 'WHATSAPP' },
  { name: 'Conversational Components', path: 'src/app/conversational-components/page.tsx', route: '/conversational-components', category: 'WHATSAPP' },
  { name: 'Tags', path: 'src/app/tags/page.tsx', route: '/tags', category: 'MANAGEMENT' },
  { name: 'Columns', path: 'src/app/columns/page.tsx', route: '/columns', category: 'MANAGEMENT' },
  { name: 'Opts Management', path: 'src/app/opts/page.tsx', route: '/opts', category: 'MANAGEMENT' },
  { name: 'Webhook Events', path: 'src/app/webhooks/page.tsx', route: '/webhooks', category: 'TOOLS' },
  { name: 'Gallery', path: 'src/app/gallery/page.tsx', route: '/gallery', category: 'TOOLS' },
  { name: 'FAQ Bot', path: 'src/app/faq/page.tsx', route: '/faq', category: 'TOOLS' },
  { name: 'Ai assistant', path: 'src/app/assistant/page.tsx', route: '/assistant', category: 'TOOLS' },
  { name: 'Flows', path: 'src/app/flows/page.tsx', route: '/flows', category: 'TOOLS' },
  { name: 'Projects', path: 'src/app/projects/page.tsx', route: '/projects', category: 'WORKSPACE' },
  { name: 'Tasks', path: 'src/app/tasks/page.tsx', route: '/tasks', category: 'WORKSPACE' },
  { name: 'Settings', path: 'src/app/settings/page.tsx', route: '/settings', category: 'WORKSPACE' },
  { name: 'Knowledge Base', path: 'src/app/knowledge/page.tsx', route: '/knowledge', category: 'WORKSPACE' },
  { name: 'Developers', path: 'src/app/developers/page.tsx', route: '/developers', category: 'WORKSPACE' },
  { name: 'Operations Guide', path: 'src/app/guide/page.tsx', route: '/guide', category: 'WORKSPACE' }
];

console.log("=== AUDITING SIDEBAR ROUTES ===");

const results = [];

for (const r of routes) {
  const fullPath = path.resolve(r.path);
  if (!fs.existsSync(fullPath)) {
    results.push({ name: r.name, route: r.route, category: r.category, status: 'FILE_MISSING' });
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const hasFetch = content.includes('fetch(') || content.includes('axios.');
  const fetches = [];
  const fetchMatches = content.matchAll(/(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*[`'"]([^`'"]+)[`'"]/g);
  for (const m of fetchMatches) {
    fetches.push(m[1]);
  }

  const hasLoadingState = content.includes('loading') || content.includes('isLoading') || content.includes('Spinner') || content.includes('Loader');
  const hasErrorState = content.includes('error') || content.includes('isError') || content.includes('setError');
  const hasEmptyState = content.includes('length === 0') || content.includes('No ') || content.includes('empty');
  const hasDummyData = content.includes('mock') || content.includes('preconfigured') || content.includes('initial') || content.includes('sample');

  results.push({
    name: r.name,
    route: r.route,
    category: r.category,
    hasBackendApi: hasFetch,
    apiEndpoints: [...new Set(fetches)],
    hasLoadingState,
    hasErrorState,
    hasEmptyState,
    lines: content.split('\n').length
  });
}

console.log(JSON.stringify(results, null, 2));
