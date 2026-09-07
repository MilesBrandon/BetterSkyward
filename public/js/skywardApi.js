/**
 * skywardApi.js
 * Modular API client for Newest Skyward client.
 * 
 * Handles switching seamlessly between local mock data (Phase 1)
 * and authenticated Qmlativ REST/XHR endpoints mapped from Chrome DevTools (Phase 2).
 */

class SkywardApiClient {
  constructor(config = {}) {
    this.mode = config.mode || 'mock'; // 'mock' | 'live'
    this.districtUrl = config.districtUrl || '';
    this.sessionCookie = config.sessionCookie || '';
    this.studentId = config.studentId || null;
    this.mockDataUrl = config.mockDataUrl || '/data/mock_grades.json';
    
    // Internal cache
    this._cachedGrades = null;
    this._lastFetched = null;
    
    // Callback listeners
    this._sessionExpiredListeners = [];

    // Mapped Qmlativ internal endpoint templates (to be filled from Chrome DevTools in Phase 2)
    this.endpoints = {
      grades: '/api/v1/gradebook/courses',
      courseDetails: '/api/v1/gradebook/courses/:courseId',
      assignments: '/api/v1/gradebook/courses/:courseId/assignments',
      sessionStatus: '/api/v1/auth/session/status',
    };
  }

  /**
   * Configure active session from DevTools capture / ClassLink SSO
   * @param {Object} params 
   */
  configureSession({ districtUrl, sessionCookie, studentId, mode }) {
    if (districtUrl) this.districtUrl = districtUrl.replace(/\/+$/, '');
    if (sessionCookie) this.sessionCookie = sessionCookie;
    if (studentId) this.studentId = studentId;
    if (mode) this.mode = mode;
    this._cachedGrades = null; // Invalidate cache on session update
  }

  /**
   * Switch data source mode
   * @param {'mock' | 'live'} mode 
   */
  setDataSource(mode) {
    if (mode !== 'mock' && mode !== 'live') {
      throw new Error(`Invalid data source mode: ${mode}. Must be 'mock' or 'live'.`);
    }
    this.mode = mode;
  }

  /**
   * Register a callback triggered when an authenticated session expires
   */
  onSessionExpired(callback) {
    if (typeof callback === 'function') {
      this._sessionExpiredListeners.push(callback);
    }
  }

  _notifySessionExpired() {
    this._sessionExpiredListeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Error in onSessionExpired listener:', err);
      }
    });
  }

  /**
   * Fetch full grades and course listing
   * @param {Object} options
   * @param {boolean} [options.forceRefresh=false]
   * @returns {Promise<Object>} Gradebook payload
   */
  async getGrades({ forceRefresh = false } = {}) {
    if (!forceRefresh && this._cachedGrades) {
      return this._cachedGrades;
    }

    if (this.mode === 'mock') {
      try {
        const response = await fetch(this.mockDataUrl);
        if (!response.ok) {
          throw new Error(`Failed to load mock grades: HTTP ${response.status}`);
        }
        const data = await response.json();
        this._cachedGrades = data;
        this._lastFetched = new Date();
        return data;
      } catch (error) {
        console.error('[SkywardApi] Mock fetch failed:', error);
        throw new Error(`Unable to fetch mock grade data. ${error.message}`);
      }
    }

    // Live endpoint mode (Phase 2 hooks)
    if (!this.districtUrl) {
      throw new Error('District endpoint URL is not configured. Run configureSession({ districtUrl }) first.');
    }

    const targetUrl = `${this.districtUrl}${this.endpoints.grades}`;
    try {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      // Add captured session cookie header if evaluating in proxy or direct browser environment
      if (this.sessionCookie) {
        headers['X-Skyward-Session'] = this.sessionCookie;
      }

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (response.status === 401 || response.status === 403) {
        this._notifySessionExpired();
        throw new Error('Skyward session expired. Please re-authenticate via ClassLink SSO.');
      }

      if (!response.ok) {
        throw new Error(`Skyward server returned error HTTP ${response.status}`);
      }

      const liveData = await response.json();
      const normalizedData = this._normalizeLivePayload(liveData);
      this._cachedGrades = normalizedData;
      this._lastFetched = new Date();
      return normalizedData;
    } catch (error) {
      console.error('[SkywardApi] Live endpoint fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get single course details with assignment drill-down
   * @param {string} courseId 
   */
  async getCourse(courseId) {
    const data = await this.getGrades();
    const course = data.courses.find(c => c.id === courseId || c.courseCode === courseId);
    if (!course) {
      throw new Error(`Course with ID ${courseId} not found.`);
    }
    return course;
  }

  /**
   * Aggregate all missing assignments across courses sorted by due date
   */
  async getMissingAssignments() {
    const data = await this.getGrades();
    const missing = [];

    data.courses.forEach(course => {
      (course.assignments || []).forEach(assignment => {
        if (assignment.status === 'missing' || (assignment.score === null && assignment.percent === null && assignment.maxScore > 0 && assignment.notes?.toLowerCase().includes('missing'))) {
          missing.push({
            ...assignment,
            courseId: course.id,
            courseName: course.name,
            coursePeriod: course.period,
            teacher: course.teacher.name,
            teacherEmail: course.teacher.email,
          });
        }
      });
    });

    return missing.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  /**
   * Calculate summary statistics (GPA, missing assignments, courses)
   */
  async getSummaryStats() {
    const data = await this.getGrades();
    const courses = data.courses || [];
    
    let totalPoints = 0;
    let validCoursesForGpa = 0;
    let missingCount = 0;
    const gradeBreakdown = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    courses.forEach(course => {
      if (course.grade && typeof course.grade.points === 'number') {
        totalPoints += course.grade.points;
        validCoursesForGpa++;
      }

      const letterBase = (course.grade?.letter || '').charAt(0).toUpperCase();
      if (gradeBreakdown[letterBase] !== undefined) {
        gradeBreakdown[letterBase]++;
      }

      missingCount += (course.missingCount || 0);
    });

    const unweightedGpa = validCoursesForGpa > 0 
      ? Number((totalPoints / validCoursesForGpa).toFixed(2)) 
      : 0.0;

    return {
      student: data.student,
      unweightedGpa,
      weightedGpa: data.summary?.weightedGpa || (unweightedGpa + 0.5),
      totalCourses: courses.length,
      missingCount,
      gradeBreakdown,
      lastSynced: data.student?.lastSynced || new Date().toISOString()
    };
  }

  _normalizeLivePayload(liveData) {
    if (liveData.courses && liveData.student) {
      return liveData;
    }
    return {
      student: {
        id: liveData.studentId || 'unknown',
        name: liveData.studentName || 'Student',
        currentTerm: liveData.term || 'Current Term',
        lastSynced: new Date().toISOString()
      },
      courses: (liveData.classes || []).map((cls, idx) => ({
        id: cls.classId || `crs-${idx}`,
        name: cls.className || 'Untitled Course',
        courseCode: cls.courseCode || '',
        period: cls.periodNumber || idx + 1,
        teacher: { name: cls.teacherName || 'Instructor', email: cls.teacherEmail || '' },
        grade: {
          letter: cls.letterGrade || 'N/A',
          percent: cls.percentScore || 0,
          points: cls.gradePoints || 0
        },
        categories: cls.categories || [],
        missingCount: cls.missingCount || 0,
        assignments: cls.assignments || []
      }))
    };
  }
}

export const skywardApi = new SkywardApiClient();
export { SkywardApiClient };
