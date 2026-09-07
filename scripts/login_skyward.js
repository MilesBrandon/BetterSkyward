/**
 * scripts/login_skyward.js
 * Launches ClassLink SSO in your browser for seamless authentication.
 */

import { exec } from 'child_process';
import readline from 'readline';

const CLASSLINK_URL = 'https://myapps.classlink.com/home';
const SKYWARD_DIRECT_URL = 'https://skyq.alpinedistrict.org/Student/Home/StudentAccess/Home';

console.log(`\n======================================================`);
console.log(`  ⚡ Newest Skyward - ClassLink SSO Auth Assistant`);
console.log(`======================================================\n`);
console.log(`Opening your browser to ClassLink SSO...`);

// Open in Firefox or default browser
exec(`open "${CLASSLINK_URL}" || open "${SKYWARD_DIRECT_URL}"`, (err) => {
  if (err) {
    console.error('Failed to open browser automatically:', err.message);
    console.log(`Please open this URL manually: ${CLASSLINK_URL}`);
  }
});

console.log(`\n📋 Quick Steps:`);
console.log(`  1. Log into your ClassLink account.`);
console.log(`  2. Click the Skyward Qmlativ tile.`);
console.log(`  3. In Chrome/Firefox, press F12 -> Network tab -> click "Student Grades".`);
console.log(`  4. Right-click the request -> Copy as cURL.`);
console.log(`  5. Paste the cURL here to immediately sync live grades with Newest Skyward!\n`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Paste your cURL command here (or press Enter to exit): ', async (curlText) => {
  if (!curlText.trim()) {
    console.log('No cURL provided. You can also paste it in the dashboard DevTools drawer at http://localhost:3000');
    rl.close();
    return;
  }

  try {
    const res = await fetch('http://localhost:3000/api/skyward/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curl: curlText })
    });

    const data = await res.json();
      console.log(`✅ Session successfully captured (Session ID: ${data.sessionId.slice(0, 8)})!`);
      console.log('Syncing live grades now...');
      const syncRes = await fetch('http://localhost:3000/api/skyward/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.sessionId}`
        }
      });
      const syncData = await syncRes.json();
      if (syncData.success) {
        console.log('🎉 Live grades successfully synced with Alpine School District!');
        console.log('Open your dashboard: http://localhost:3000\n');
      } else {
        console.log('Sync note:', syncData.error);
      }
    } else {
      console.error('Failed to parse session:', data.error);
    }
  } catch (err) {
    console.error('Error connecting to local dev server:', err.message);
  }

  rl.close();
});

