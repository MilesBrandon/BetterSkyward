import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { skywardProxy } from './src/proxy/skywardProxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MOCK_DATA_FILE = path.join(__dirname, 'data', 'mock_grades.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ============================================================================
// Multi-Tenant In-Memory Session Store
// Key: sessionId (UUID) -> Value: { skywardCookies, skywardSession, createdAt, lastActivity, timeoutHandle }
// ============================================================================
const sessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function scheduleSessionTimeout(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }
  session.timeoutHandle = setTimeout(() => {
    console.log(`[SessionStore] Session ${sessionId.slice(0, 8)} timed out after 10m inactivity. Discarding.`);
    sessions.delete(sessionId);
  }, SESSION_TTL_MS);
}

function createSession(skywardSession) {
  const sessionId = crypto.randomUUID();
  const entry = {
    skywardCookies: skywardSession.cookie || '',
    skywardSession,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    timeoutHandle: null
  };
  sessions.set(sessionId, entry);
  scheduleSessionTimeout(sessionId);
  console.log(`[SessionStore] Created new session ${sessionId.slice(0, 8)} (Total active: ${sessions.size})`);
  return sessionId;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function touchSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.lastActivity = Date.now();
  scheduleSessionTimeout(sessionId);
  return true;
}

function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }
  const deleted = sessions.delete(sessionId);
  console.log(`[SessionStore] Discarded session ${sessionId.slice(0, 8)} (Remaining active: ${sessions.size})`);
  return deleted;
}

function extractSessionId(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  if (req.headers['x-session-id']) {
    return String(req.headers['x-session-id']).trim();
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id, X-Skyward-Session');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // --------------------------------------------------------------------------
  // API: Direct Authentication
  // --------------------------------------------------------------------------
  if (pathname === '/api/skyward/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let payload = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          const params = new URLSearchParams(body);
          if (params.has('username')) {
            payload = {
              username: params.get('username'),
              password: params.get('password')
            };
          } else {
            throw new Error('Invalid JSON format in request body.');
          }
        }
        const { username, password } = payload;
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Username and password are required.' }));
          return;
        }

        console.log(`[Server] Direct login request received for: ${username}`);
        const result = await skywardProxy.authenticateWithCredentials(username, password);
        const sessionId = createSession(result.session);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          sessionId,
          student: result.data.student,
          data: result.data,
          coursesCount: result.data.courses.length,
          expiresIn: 600
        }));
      } catch (err) {
        console.error('[Server] Login failure:', err.message);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // API: Live Grade Sync (Scoped by Bearer Token)
  // --------------------------------------------------------------------------
  if (pathname === '/api/skyward/sync' && (req.method === 'GET' || req.method === 'POST')) {
    const sessionId = extractSessionId(req);
    const sessionEntry = getSession(sessionId);

    if (!sessionId || !sessionEntry) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Session invalid or expired (10m inactivity timeout).' }));
      return;
    }

    try {
      touchSession(sessionId);
      console.log(`[Server] Triggering live Skyward sync for session: ${sessionId.slice(0, 8)}...`);
      const freshData = await skywardProxy.fetchLiveGrades(sessionEntry.skywardSession);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: freshData,
        expiresIn: 600
      }));
    } catch (error) {
      console.error('[Server] Live sync error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  // --------------------------------------------------------------------------
  // API: User Logout (Scoped to Single Session)
  // --------------------------------------------------------------------------
  if (pathname === '/api/skyward/logout' && req.method === 'POST') {
    const sessionId = extractSessionId(req);
    if (sessionId) {
      deleteSession(sessionId);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Session logged out and cleared.' }));
    return;
  }

  // --------------------------------------------------------------------------
  // API: Gradebook Reader (Mock data for demo; live stream for authenticated sessions)
  // --------------------------------------------------------------------------
  if (pathname === '/api/grades') {
    const source = reqUrl.searchParams.get('source');
    const sessionId = extractSessionId(req);
    const sessionEntry = getSession(sessionId);

    if (source === 'live' && sessionEntry) {
      try {
        touchSession(sessionId);
        const freshData = await skywardProxy.fetchLiveGrades(sessionEntry.skywardSession);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(freshData));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // Default: Mock grade data for demo exploration
    fs.readFile(MOCK_DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read mock gradebook data' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // --------------------------------------------------------------------------
  // API: DevTools cURL Session Capture
  // --------------------------------------------------------------------------
  if (pathname === '/api/skyward/session' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        let skySession = null;
        if (payload.curl) {
          skySession = skywardProxy.parseCurlCommand(payload.curl);
        } else if (payload.session) {
          skySession = payload.session;
        }
        if (!skySession) {
          throw new Error('No curl command or session payload provided.');
        }

        const sessionId = createSession(skySession);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, sessionId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // API: Status and Health
  // --------------------------------------------------------------------------
  if (pathname === '/api/skyward/status') {
    const sessionId = extractSessionId(req);
    const sessionEntry = getSession(sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      district: 'Alpine School District UT',
      activeSessions: sessions.size,
      authenticated: !!sessionEntry,
      student: sessionEntry?.skywardSession?.studentName || null
    }));
    return;
  }

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', project: 'BetterSkyward', sessionsCount: sessions.size }));
    return;
  }

  // --------------------------------------------------------------------------
  // Static File Serving
  // --------------------------------------------------------------------------
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (pathname.startsWith('/data/')) {
    filePath = path.join(__dirname, pathname);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`  ⚡ BetterSkyward Multi-Tenant Server Running!`);
  console.log(`  Dashboard:    http://localhost:${PORT}        `);
  console.log(`  Grade API:    http://localhost:${PORT}/api/grades `);
  console.log(`===============================================`);
});
