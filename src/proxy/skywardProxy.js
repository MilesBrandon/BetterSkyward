/**
 * skywardProxy.js
 * Stateless live proxy client and gradebook synchronizer for Skyward Qmlativ (Alpine School District).
 * Operates purely in-memory with zero disk persistence.
 */

import { parseQmlativGrades, parseAssignmentsTable } from './skywardParser.js';

const BUCKET_MAP = {};

export class SkywardProxy {
  constructor() {
    this.baseUrl = 'https://skyq.alpinedistrict.org';
  }

  /**
   * Parse cURL command from Chrome/Firefox DevTools
   * Returns a standalone session object without mutating any shared state.
   */
  parseCurlCommand(curlText) {
    if (!curlText || typeof curlText !== 'string') {
      throw new Error('Invalid cURL command input');
    }

    const cleaned = curlText.replace(/\\\n/g, ' ').replace(/\s+/g, ' ');

    const session = {
      windowGuid: '',
      pageStateGuid: '',
      sessionGuidHash: '',
      cookie: '',
      username: '',
      studentName: '',
      lastUpdated: new Date().toISOString()
    };

    const urlMatch = cleaned.match(/curl\s+(?:--location\s+)?(?:-X\s+[A-Z]+\s+)?['"]([^'"]+)['"]/) ||
                     cleaned.match(/curl\s+([^'"\s]+)/);

    if (urlMatch) {
      try {
        const rawUrl = urlMatch[1].trim();
        const parsedUrl = new URL(rawUrl);
        this.baseUrl = parsedUrl.origin;
        const w = parsedUrl.searchParams.get('w');
        const p = parsedUrl.searchParams.get('p');
        if (w) session.windowGuid = w;
        if (p) session.pageStateGuid = p;
      } catch (err) {
        console.warn('[SkywardProxy] Could not parse URL from curl:', err.message);
      }
    }

    const cookieHeaderMatch = cleaned.match(/-H\s+['"]Cookie:\s*([^'"]+)['"]/i) ||
                              cleaned.match(/(?:--cookie|-b)\s+['"]([^'"]+)['"]/i);
    if (cookieHeaderMatch) {
      session.cookie = cookieHeaderMatch[1].trim();
    }

    const sghMatch = cleaned.match(/sgh=([a-zA-Z0-9_-]+)/) ||
                     cleaned.match(/X-CSRF-TOKEN:\s*([a-zA-Z0-9_-]+)/i);
    if (sghMatch) {
      session.sessionGuidHash = sghMatch[1];
    }

    return session;
  }

  /**
   * Direct Skyward STS Credentials Authentication
   * @param {string} username Student Skyward Username
   * @param {string} password Student Skyward Password
   * @returns {Promise<Object>} Synchronized gradebook data
   */
  async authenticateWithCredentials(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const session = {
      windowGuid: '',
      pageStateGuid: '',
      sessionGuidHash: '',
      cookie: '',
      username: username.trim(),
      studentName: '',
      lastUpdated: new Date().toISOString()
    };

    console.log(`[SkywardProxy] Authenticating user "${username}" against Alpine StudentSTS...`);

    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0';
    const cookieJar = new Map();

    const updateCookieJar = (res) => {
      const rawCookies = res.headers.getSetCookie 
        ? res.headers.getSetCookie() 
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      
      rawCookies.forEach(str => {
        if (!str) return;
        const parts = str.split(';');
        const [name, ...valParts] = parts[0].split('=');
        if (name && name.trim()) {
          const val = valParts.join('=');
          cookieJar.set(name.trim(), val);
        }
      });
    };

    const getCookieHeader = () => {
      return Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    };

    // Step 1: GET /StudentSTS to obtain anti-forgery tokens & initial cookies
    console.log('[SkywardProxy] STS Step 1: Requesting login form and antiforgery token...');
    const stsUrl = `${this.baseUrl}/StudentSTS`;
    const getRes = await fetch(stsUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    updateCookieJar(getRes);
    const getHtml = await getRes.text();

    const tokenMatch = getHtml.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/);
    if (!tokenMatch) {
      throw new Error('Unable to extract __RequestVerificationToken from StudentSTS page.');
    }
    const requestVerificationToken = tokenMatch[1];

    // Step 2: POST /StudentSTS with credentials
    console.log('[SkywardProxy] STS Step 2: Submitting credentials...');
    const formParams = new URLSearchParams();
    formParams.append('UserName', username.trim());
    formParams.append('Password', password);
    formParams.append('__RequestVerificationToken', requestVerificationToken);
    formParams.append('Area', '');
    formParams.append('Controller', '');
    formParams.append('Action', '');
    formParams.append('Tab', '');
    formParams.append('Id', '');
    formParams.append('AllowLimitedAccessAccountCreation', 'False');
    formParams.append('JSUserAgent', userAgent);
    formParams.append('ScreenWidth', '1920');
    formParams.append('ScreenHeight', '1080');
    formParams.append('LoginCode', '');
    formParams.append('Button', 'Sign In');

    let postRes = await fetch(stsUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieHeader(),
        'Origin': this.baseUrl,
        'Referer': stsUrl
      },
      body: formParams.toString(),
      redirect: 'manual'
    });

    updateCookieJar(postRes);

    // Follow redirects manually to capture every Set-Cookie step
    let redirectCount = 0;
    while ((postRes.status === 301 || postRes.status === 302 || postRes.status === 303 || postRes.status === 307 || postRes.status === 308) && redirectCount < 8) {
      redirectCount++;
      const loc = postRes.headers.get('location');
      if (!loc) break;
      const targetUrl = new URL(loc, this.baseUrl).href;
      console.log(`[SkywardProxy] STS Redirect ${redirectCount}: ${targetUrl}`);
      postRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': getCookieHeader(),
          'Referer': stsUrl
        },
        redirect: 'manual'
      });
      updateCookieJar(postRes);
    }

    const postHtml = await postRes.text();

    // Check for error prompt message from STS
    const errorMatch = postHtml.match(/class="cmaMessageContent__promptMessageText[^"]*"[^>]*>([^<]+)<\/p>/i);
    if (errorMatch && errorMatch[1]) {
      const errText = errorMatch[1].trim();
      throw new Error(errText || 'Invalid Username or Password provided to Skyward.');
    }

    if (postHtml.includes('The Username or Password provided is incorrect')) {
      throw new Error('The Username or Password provided is incorrect.');
    }

    // Step 3: Now access StudentAccess/Home to initialize the Skyward window & state GUIDs
    console.log('[SkywardProxy] STS Step 3: Establishing active StudentAccess session...');
    const homeUrl = `${this.baseUrl}/Student/Home/StudentAccess/Home`;
    let homeRes = await fetch(homeUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': getCookieHeader()
      },
      redirect: 'manual'
    });
    updateCookieJar(homeRes);

    // If 302 redirect with p and w parameters
    if (homeRes.status === 302 || homeRes.status === 301 || homeRes.status === 303) {
      const loc = homeRes.headers.get('location');
      if (loc) {
        const redirectedHomeUrl = new URL(loc, this.baseUrl);
        const w = redirectedHomeUrl.searchParams.get('w');
        const p = redirectedHomeUrl.searchParams.get('p');
        if (w) session.windowGuid = w;
        if (p) session.pageStateGuid = p;

        homeRes = await fetch(redirectedHomeUrl.href, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': getCookieHeader()
          },
          redirect: 'manual'
        });
        updateCookieJar(homeRes);
      }
    }

    const homeHtml = await homeRes.text();

    // Extract windowGuid, pageStateGuid, sessionGuidHash
    const sghMatch = homeHtml.match(/window\._skyward\.global\.sessionGuidHash\s*=\s*['"]([^'"]+)['"]/);
    const winMatch = homeHtml.match(/window\._skyward\.global\.windowGuid\s*=\s*['"]([^'"]+)['"]/);
    const pageMatch = homeHtml.match(/window\._skyward\.global\.pageStateGuid\s*=\s*['"]([^'"]+)['"]/);

    if (sghMatch) session.sessionGuidHash = sghMatch[1];
    if (winMatch) session.windowGuid = winMatch[1];
    if (pageMatch) session.pageStateGuid = pageMatch[1];

    session.cookie = getCookieHeader();
    session.username = username.trim();
    session.lastUpdated = new Date().toISOString();

    if (!session.sessionGuidHash || !session.windowGuid) {
      if (!session.cookie.includes('SessionIDStudent')) {
        throw new Error('Authentication succeeded but failed to acquire SessionIDStudent cookie.');
      }
    }

    console.log('[SkywardProxy] ✓ Direct authentication successful!');

    // Step 4: Immediately trigger live sync to refresh all grades
    const freshData = await this.fetchLiveGrades(session);
    return {
      success: true,
      session,
      data: freshData
    };
  }

  /**
   * Full Sync: Fetches course grades, GPA, teacher names, category weights, and individual assignments.
   * @param {Object} session User Skyward session object
   */
  async fetchLiveGrades(session) {
    if (!session || !session.cookie) {
      throw new Error('No active Skyward session provided. Please log into Skyward first.');
    }
    const { sessionGuidHash, cookie } = session;
    const windowGuid = session.windowGuid;
    const pageStateGuid = session.pageStateGuid;
    console.log('[SkywardProxy] Step 1: Initializing Qmlativ StudentAccess page...');

    const accessUrl = `${this.baseUrl}/Student/Grading/StudentSection/StudentAccess?w=${windowGuid}&p=${pageStateGuid}`;

    const res1 = await fetch(accessUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': this.baseUrl,
        'Referer': `${this.baseUrl}/Student/Home/StudentAccess/Home?p=${pageStateGuid}&w=${windowGuid}`,
        'Cookie': cookie
      },
      body: `sgh=${sessionGuidHash}`,
      redirect: 'follow'
    });

    if (res1.status === 401 || res1.status === 403) {
      throw new Error(`Skyward session expired (HTTP ${res1.status}). Please log into Skyward again.`);
    }

    const html1 = await res1.text();
    const finalUrl = new URL(res1.url);
    const updatedP = finalUrl.searchParams.get('p') || pageStateGuid;
    const updatedW = finalUrl.searchParams.get('w') || windowGuid;
    session.pageStateGuid = updatedP;
    session.windowGuid = updatedW;

    // Extract StudentGrades browse configuration dynamically (supports any student's browse instance ID)
    const markerMatch = html1.match(/skyward\.browse\.browseList\['(StudentGrades-[^']+)'\]\s*=\s*/);
    if (!markerMatch) {
      throw new Error('StudentGrades configuration not found on Skyward page.');
    }

    const marker = markerMatch[0];
    const start = html1.indexOf(marker);
    let cut = html1.substring(start + marker.length, html1.indexOf(';</script>', start));
    const cutIdx = cut.indexOf(';skyward.');
    if (cutIdx !== -1) cut = cut.substring(0, cutIdx);
    const cfg = Function('"use strict"; return (' + cut.replace(/\$\([^\)]*\)/g, 'null') + ')')();

    // Extract StudentGPA browse configuration dynamically if present
    let gpaCfg = null;
    const gpaMatch = html1.match(/skyward\.browse\.browseList\['(StudentGPA-[^']+)'\]\s*=\s*/);
    if (gpaMatch) {
      try {
        const gpaMarker = gpaMatch[0];
        const gpaStart = html1.indexOf(gpaMarker);
        let gpaCut = html1.substring(gpaStart + gpaMarker.length, html1.indexOf(';</script>', gpaStart));
        const gpaCutIdx = gpaCut.indexOf(';skyward.');
        if (gpaCutIdx !== -1) gpaCut = gpaCut.substring(0, gpaCutIdx);
        gpaCfg = Function('"use strict"; return (' + gpaCut.replace(/\$\([^\)]*\)/g, 'null') + ')')();
      } catch (err) {
        console.warn('[SkywardProxy] Could not parse StudentGPA configuration:', err.message);
      }
    }

    // Step 2: Request GetBrowse for course table and GPA in parallel
    console.log('[SkywardProxy] Step 2: Fetching live course overview and official GPA records in parallel...');
    const browseUrl = `${this.baseUrl}/Student/${cfg.routeModule}/${cfg.routeObject}/GetBrowse?w=${updatedW}&p=${updatedP}`;
    const postData = {
      pageModule: cfg.pageModule,
      pageObject: cfg.pageObject,
      pageScreen: cfg.pageScreen,
      pageTab: cfg.pageTab,
      routeModule: cfg.routeModule,
      routeObject: cfg.routeObject,
      dataModule: cfg.dataModule,
      dataObject: cfg.dataObject,
      browseName: cfg.browseName,
      browseId: cfg.id,
      rowDataDefinitions: cfg.rowDataDefinitions ? JSON.stringify(cfg.rowDataDefinitions) : undefined,
      queryParameterData: cfg.queryParameterData ? JSON.stringify(cfg.queryParameterData) : undefined,
      queryParameterDataHash: cfg.queryParameterDataHash,
      requestDataHash: cfg.requestDataHash,
      performSearch: 'true',
      postData: JSON.stringify(cfg.data),
      filter: cfg.data?.filter,
      timestamp: Date.now()
    };
    Object.keys(postData).forEach(k => postData[k] === undefined && delete postData[k]);

    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': this.baseUrl,
      'Referer': res1.url,
      'Cookie': cookie,
      'X-CSRF-TOKEN': sessionGuidHash,
      'X-Requested-With': 'XMLHttpRequest'
    };

    const fetchCoursesPromise = fetch(browseUrl, {
      method: 'POST',
      headers: reqHeaders,
      body: new URLSearchParams(postData).toString()
    });

    let fetchGpaPromise = Promise.resolve(null);
    if (gpaCfg) {
      const gpaBrowseUrl = `${this.baseUrl}/Student/${gpaCfg.routeModule}/${gpaCfg.routeObject}/GetBrowse?w=${updatedW}&p=${updatedP}`;
      const gpaPostData = {
        pageModule: gpaCfg.pageModule,
        pageObject: gpaCfg.pageObject,
        pageScreen: gpaCfg.pageScreen,
        pageTab: gpaCfg.pageTab,
        routeModule: gpaCfg.routeModule,
        routeObject: gpaCfg.routeObject,
        dataModule: gpaCfg.dataModule,
        dataObject: gpaCfg.dataObject,
        browseName: gpaCfg.browseName,
        browseId: gpaCfg.id,
        rowDataDefinitions: gpaCfg.rowDataDefinitions ? JSON.stringify(gpaCfg.rowDataDefinitions) : undefined,
        queryParameterData: gpaCfg.queryParameterData ? JSON.stringify(gpaCfg.queryParameterData) : undefined,
        queryParameterDataHash: gpaCfg.queryParameterDataHash,
        requestDataHash: gpaCfg.requestDataHash,
        performSearch: 'true',
        postData: JSON.stringify(gpaCfg.data),
        filter: gpaCfg.data?.filter,
        timestamp: Date.now()
      };
      Object.keys(gpaPostData).forEach(k => gpaPostData[k] === undefined && delete gpaPostData[k]);
      fetchGpaPromise = fetch(gpaBrowseUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: new URLSearchParams(gpaPostData).toString()
      }).catch(err => {
        console.warn('[SkywardProxy] Error fetching StudentGPA browse:', err.message);
        return null;
      });
    }

    const [res2, gpaRes] = await Promise.all([fetchCoursesPromise, fetchGpaPromise]);

    let gpaHtml = '';
    if (gpaRes && gpaRes.ok) {
      try {
        const gpaPayload = await gpaRes.json();
        gpaHtml = gpaPayload.html || '';
      } catch (e) {
        console.warn('[SkywardProxy] Could not parse GPA JSON payload:', e.message);
      }
    }

    // Extract student identity from the top bar if available
    const nameMatch = html1.match(/utilitiesButtonMain__textWrapper--username[\s\S]*?<p[^>]*>([^<]+)<\/p>[\s\S]*?<p[^>]*>([^<]+)<\/p>/i);
    const studentInfo = {
      name: nameMatch ? `${nameMatch[1].trim()} ${nameMatch[2].trim()}` : (session.studentName || 'Student'),
      id: session.username || 'Student'
    };
    if (nameMatch) {
      session.studentName = studentInfo.name;
    }

    const payload2 = await res2.json();
    const normalized = parseQmlativGrades(payload2.html, gpaHtml, studentInfo);

    // Step 3: Fetch assignment details for every course in parallel
    console.log(`[SkywardProxy] Step 3: Syncing detailed assignments for ${normalized.courses.length} courses (${normalized.student.name})...`);
    for (const course of normalized.courses) {
      if (course.isUpcoming) {
        course.categories = [];
        course.assignments = [];
        course.missingCount = 0;
        continue;
      }

      const secId = course.sectionId || course.id.replace('crs-', '');
      const bucketId = course.gradeBucketId || BUCKET_MAP[secId];
      course.gradeBucketId = bucketId;

      if (!bucketId) continue;

      try {
        const detailUrl = `${this.baseUrl}/Student/Gradebook/ProgressReport/GradeBucketBreakdownStudentAccess/${bucketId}?w=${updatedW}&p=${updatedP}`;
        const detailRes = await fetch(detailUrl, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/Student/Grading/StudentSection/StudentAccess?w=${updatedW}&p=${updatedP}`,
            'Cookie': cookie
          },
          body: `StudentGradeBucketID=${bucketId}`,
          redirect: 'follow'
        });

        const detailHtml = await detailRes.text();

        // Extract Teacher Name
        const teacherMatch = detailHtml.match(/data-click-action="progressreport\.staffPopup"[^>]*>[\s\S]*?<span[^>]*class="anchorText"[^>]*>([^<]+)<\/span>/i);
        if (teacherMatch) {
          course.teacher.name = teacherMatch[1].trim();
        }

        // Extract Exact Percentage
        const pctMatch = detailHtml.match(/(\d+\.\d+)\s*%/);
        if (pctMatch) {
          course.grade.percent = parseFloat(pctMatch[1]);
        }

        // Extract Raw PostData for assignments browse
        const asgMarker = 'SegmentedGradeBucketAssignments';
        const asgStartIdx = detailHtml.indexOf(asgMarker);
        if (asgStartIdx === -1) continue;

        const dataMarker = 'data:{';
        const dStart = detailHtml.indexOf(dataMarker, asgStartIdx);
        if (dStart === -1) continue;

        let depth = 0, dEnd = -1;
        for (let i = dStart + 5; i < detailHtml.length; i++) {
          if (detailHtml[i] === '{') depth++;
          else if (detailHtml[i] === '}') {
            depth--;
            if (depth === 0) { dEnd = i + 1; break; }
          }
        }
        const rawPostData = detailHtml.substring(dStart + 5, dEnd);
        const reqHashMatch = detailHtml.substring(asgStartIdx).match(/requestDataHash:\s*[\x27"]([^\x27"]+)[\x27"]/);
        const queryHashMatch = detailHtml.substring(asgStartIdx).match(/queryParameterDataHash:\s*[\x27"]([^\x27"]+)[\x27"]/);

        // Fetch assignment rows
        const asgBrowseUrl = `${this.baseUrl}/Student/Gradebook/Assignment/GetBrowse?w=${updatedW}&p=${updatedP}`;
        const asgParams = new URLSearchParams({
          pageModule: 'Gradebook',
          pageObject: 'ProgressReport',
          pageScreen: 'GradeBucketAssignmentsSegmented',
          pageTab: '',
          routeModule: 'Gradebook',
          routeObject: 'Assignment',
          dataModule: 'Gradebook',
          dataObject: 'Assignment',
          browseName: 'detailsPanel_SegmentedGradeBucketAssignments',
          browseId: 'detailsPanel_SegmentedGradeBucketAssignments',
          hideIfEmpty: 'false',
          selectMode: 'false',
          isCodeEel: 'false',
          queryParameterDataHash: queryHashMatch?.[1] || '',
          requestDataHash: reqHashMatch?.[1] || '',
          timestamp: Date.now(),
          displayName: 'Assignments',
          dynamicHeight: 'false',
          readNoLock: 'false',
          hideBrowseControl: 'true',
          hideSelectListTotals: 'false',
          rowsPerPageCap: '',
          renderSearchBox: 'true',
          performSearch: 'true',
          getBrowseSearchMode: 'Always',
          hasCollapseExpandButton: 'false',
          disableRowHighlighting: 'true',
          preventColumnResize: 'true',
          preventColumnSort: 'true',
          renderLeftControls: 'true',
          renderViewButton: 'true',
          renderFilterButton: 'true',
          renderLiveTileAddButton: 'true',
          renderChartTileAddButton: 'true',
          renderRowsPerPageOption: 'true',
          hideReportsFromRelatedScreen: 'false',
          renderDesignReportButton: 'true',
          hideMoreMenuArea: 'false',
          renderSortableHeader: 'true',
          renderHeaderSettings: 'true',
          detailsPanelType: 'Row',
          identifyingFieldsAndValues: '',
          identityFieldValuesOfTopRecord: '',
          seekText: '',
          renderQuickFilter: 'false',
          headerNumber: '2',
          forceSingleThread: 'false',
          isRelatedBrowse: 'false',
          dynamicFilterValues: '{}',
          dynamicFilterHashes: '{}',
          browseType: 'Default',
          returnSearchCondition: 'false',
          hidePreviewDetailsButton: 'true',
          postData: rawPostData
        });

        const asgRes = await fetch(asgBrowseUrl, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/Student/Grading/StudentSection/StudentAccess?w=${updatedW}&p=${updatedP}`,
            'Cookie': cookie,
            'X-CSRF-TOKEN': sessionGuidHash,
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: asgParams.toString()
        });

        if (asgRes.ok) {
          const asgPayload = await asgRes.json();
          const parsed = parseAssignmentsTable(asgPayload.html);
          if (parsed.categories.length > 0) course.categories = parsed.categories;
          if (parsed.assignments.length > 0) {
            course.assignments = parsed.assignments;
            const asgMissing = parsed.assignments.filter(a => a.status === 'missing').length;
            course.missingCount = Math.max(course.missingCount || 0, asgMissing);
          }
        }
      } catch (err) {
        console.warn(`[SkywardProxy] Failed to sync assignments for ${course.name}:`, err.message);
      }
    }

    // Recalculate total missing count across active courses
    normalized.summary.missingCount = normalized.courses
      .filter(c => !c.isUpcoming)
      .reduce((acc, c) => acc + (c.missingCount || 0), 0);

    console.log(`[SkywardProxy] 🎉 Full gradebook sync complete for ${normalized.student.name}!`);
    return normalized;
  }
}

export const skywardProxy = new SkywardProxy();
