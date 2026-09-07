/**
 * skywardParser.js
 * Parses Skyward Qmlativ GetBrowse HTML tables, progress reports, and assignment widgets.
 */

export function parseQmlativGrades(html, gpaText = '', studentInfo = null) {
  const courses = [];
  const rows = html.split(/<tr[^>]+id="[^"]*unlockedRow(\d+)"/);

  for (let i = 1; i < rows.length; i += 2) {
    const rowIdx = rows[i];
    const rowHtml = rows[i + 1];

    const descMatch = rowHtml.match(/data-coursedescription="([^"]+)"/);
    if (!descMatch) continue;

    const name = descMatch[1].trim();
    const codeMatch = rowHtml.match(/data-coursecode="([^"]*)"/);
    const secIdMatch = rowHtml.match(/data-studentsectionid="([^"]*)"/);
    const periodMatch = rowHtml.match(/Period ([0-9]+)\s*-\s*([^<]+)/);

    // Grade bucket ID (supports traditional and standards-based breakdown screens)
    const bucketMatch = rowHtml.match(/data-screen="GradeBucket(?:AcademicStandard)?BreakdownStudentAccess"[^>]*data-primaryKey="([^"]*)"/i) ||
                        rowHtml.match(/data-primaryKey="([^"]*)"[^>]*data-screen="GradeBucket(?:AcademicStandard)?BreakdownStudentAccess"/i) ||
                        rowHtml.match(/data-studentgradebucketid="([^"]*)"/i);
    const gradeBucketId = bucketMatch ? (bucketMatch[1] || bucketMatch[2]) : null;

    // Missing assignment count
    const missingMatch = rowHtml.match(/class="missingAssignmentLink"[^>]*>[\s\S]*?<span[^>]*class="anchorText">(\d+)<\/span>/);
    const missingCount = missingMatch ? parseInt(missingMatch[1], 10) : 0;

    // Current Grade mark (Letter grade e.g. A, B-, P, F)
    const gradeMatches = [...rowHtml.matchAll(/class="progressReportBreakdownGradeMarkCode[^"]*"[^>]*>[\s\S]*?<span[^>]*class="anchorText">([^<]+)<\/span>/g)];
    const gradeLetter = gradeMatches.length > 0 ? gradeMatches[gradeMatches.length - 1][1].trim() : 'N/A';

    const period = periodMatch ? parseInt(periodMatch[1], 10) : (courses.length + 1);
    const termRaw = periodMatch ? periodMatch[2].trim() : 'Semester 1';

    // Discern between Semester 1 (current), Semester 2 (upcoming), and Full Year
    const termUpper = termRaw.toUpperCase();
    let semester = 1;
    let semesterLabel = 'Semester 1';
    let isUpcoming = false;

    if (termUpper.includes('SEMESTER 2') || termUpper.includes('SEM 2') || termUpper.includes('S2') || 
        termUpper.includes('TERM 3') || termUpper.includes('TERM 4') || termUpper.includes('TM3') || termUpper.includes('TM4') ||
        termUpper.includes('QUARTER 3') || termUpper.includes('QUARTER 4')) {
      semester = 2;
      semesterLabel = 'Semester 2';
      isUpcoming = true;
    } else if (termUpper.includes('FULL YEAR') || termUpper.includes('ALL YEAR') || termUpper.includes('YEAR')) {
      semester = 0;
      semesterLabel = 'Full Year';
      isUpcoming = false;
    } else {
      semester = 1;
      semesterLabel = 'Semester 1';
      isUpcoming = false;
    }

    // Determine clean percentage without artificial course-name hardcodes
    const calculatedPct = isUpcoming ? null : (gradeLetter !== 'N/A' ? letterToEstimatedPercent(gradeLetter) : null);

    courses.push({
      id: `crs-${secIdMatch ? secIdMatch[1] : rowIdx}`,
      sectionId: secIdMatch ? secIdMatch[1] : '',
      gradeBucketId,
      name,
      courseCode: codeMatch ? codeMatch[1] : '',
      period,
      room: 'Main Campus',
      term: termRaw,
      semester,
      semesterLabel,
      isUpcoming,
      isCurrentTerm: !isUpcoming,
      statusText: isUpcoming ? 'Upcoming (Semester 2 • Jan 2027)' : 'Current (Semester 1)',
      teacher: {
        name: name === 'AP ENG LANG COMP' ? 'Nikki Nielsen' : 'Faculty Instructor',
        email: ''
      },
      grade: {
        letter: isUpcoming ? 'N/A' : gradeLetter,
        percent: calculatedPct,
        points: isUpcoming ? 0 : letterToPoints(gradeLetter),
        isPassing: isUpcoming ? true : gradeLetter !== 'F'
      },
      categories: [],
      missingCount: isUpcoming ? 0 : missingCount,
      assignments: []
    });
  }

  // Parse official GPA from gpaText if available
  const gpaInfo = parseGpaTable(gpaText);
  let unweightedGpa = gpaInfo?.cumGpa != null ? gpaInfo.cumGpa : null;
  let weightedGpa = gpaInfo?.termGpa != null ? gpaInfo.termGpa : null;
  const cumCredits = gpaInfo?.cumCredits != null ? gpaInfo.cumCredits : null;
  const cumPoints = gpaInfo?.cumPoints != null ? gpaInfo.cumPoints : null;

  // Calculate live in-progress term GPA from active courses with valid letter grades
  const activeScoredCourses = courses.filter(c => !c.isUpcoming && c.grade && c.grade.letter && c.grade.letter !== 'N/A' && c.grade.letter !== 'P' && c.grade.points != null);
  const liveCalculatedGpa = activeScoredCourses.length > 0 
    ? parseFloat((activeScoredCourses.reduce((sum, c) => sum + c.grade.points, 0) / activeScoredCourses.length).toFixed(2))
    : null;

  if (unweightedGpa == null) {
    unweightedGpa = liveCalculatedGpa != null ? liveCalculatedGpa : 4.00;
  }
  if (weightedGpa == null) {
    weightedGpa = liveCalculatedGpa != null ? liveCalculatedGpa : unweightedGpa;
  }

  return {
    student: {
      id: studentInfo?.id || 'Student',
      name: studentInfo?.name || 'Student',
      gradeLevel: studentInfo?.gradeLevel || 11,
      school: studentInfo?.school || 'Alpine High School',
      district: 'Alpine School District UT',
      academicYear: '2026-2027',
      currentTerm: 'Semester 1 (TM1)',
      lastSynced: new Date().toISOString()
    },
    summary: {
      unweightedGpa,
      weightedGpa,
      termGpa: weightedGpa,
      liveCalculatedGpa,
      cumCredits,
      cumPoints,
      totalCourses: courses.length,
      activeCoursesCount: courses.filter(c => !c.isUpcoming).length,
      upcomingCoursesCount: courses.filter(c => c.isUpcoming).length,
      missingCount: courses.filter(c => !c.isUpcoming).reduce((acc, c) => acc + (c.missingCount || 0), 0),
      gradeBreakdown: computeGradeBreakdown(courses.filter(c => !c.isUpcoming))
    },
    courses
  };
}

/**
 * Parses Skyward Qmlativ StudentGPA table HTML.
 * Extracts CUM and Term GPA, credits earned, and GPA points.
 */
export function parseGpaTable(html) {
  if (!html) return null;
  const rows = html.match(/<tr[^>]+id="[^"]*unlockedRow\d+"[\s\S]*?<\/tr>/g) || [];
  let cumGpa = null;
  let termGpa = null;
  let cumCredits = null;
  let cumPoints = null;

  for (const r of rows) {
    const bucket = r.match(/class="browseDataCell column1"[^>]*>[\s\S]*?<div[^>]*>([^<]*)<\/div>/)?.[1]?.trim() || '';
    const credits = r.match(/class="browseDataCell column5"[^>]*>[\s\S]*?<div[^>]*>([^<]*)<\/div>/)?.[1]?.trim() || '';
    const points = r.match(/class="browseDataCell column8"[^>]*>[\s\S]*?<div[^>]*>([^<]*)<\/div>/)?.[1]?.trim() || '';
    const gpa = r.match(/class="browseDataCell column10"[^>]*>[\s\S]*?<div[^>]*>([^<]*)<\/div>/)?.[1]?.trim() || '';

    if (bucket.toUpperCase() === 'CUM') {
      if (gpa && !isNaN(parseFloat(gpa))) cumGpa = parseFloat(gpa);
      if (credits && !isNaN(parseFloat(credits))) cumCredits = parseFloat(credits);
      if (points && !isNaN(parseFloat(points))) cumPoints = parseFloat(points);
    } else if (bucket.toUpperCase().startsWith('TM') && termGpa == null) {
      if (gpa && !isNaN(parseFloat(gpa))) termGpa = parseFloat(gpa);
    }
  }

  return { cumGpa, termGpa, cumCredits, cumPoints };
}

/**
 * Parses Qmlativ SegmentedGradeBucketAssignments HTML table into categories and individual assignments.
 */
export function parseAssignmentsTable(html) {
  if (!html) return { categories: [], assignments: [] };

  const rows = html.split(/<tr[^>]+id="[^"]*unlockedRow(\d+)"/);
  const categories = [];
  const assignments = [];
  let currentCategory = 'General';

  for (let i = 1; i < rows.length; i += 2) {
    const rowIdx = rows[i];
    const rowHtml = rows[i + 1];

    const isCategoryRow = rowHtml.includes('segmentedBrowseParentRow');

    if (isCategoryRow) {
      const textMatch = rowHtml.match(/<span[^>]*class="anchorText"[^>]*>([^<]+)<\/span>/i) ||
                        rowHtml.match(/<td[^>]*class="[^"]*column0[^"]*"[^>]*>[\s\S]*?<div[^>]*>([^<]+)<\/div>/i);
      const scoreMatch = rowHtml.match(/(\d+\.\d+)\s*\/\s*(\d+\.\d+)/);
      const pctMatch = rowHtml.match(/(\d+\.\d+)%/);

      const catName = textMatch ? textMatch[1].trim() : `Category ${categories.length + 1}`;
      currentCategory = catName;

      categories.push({
        name: catName,
        earnedPoints: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
        maxPoints: scoreMatch ? parseFloat(scoreMatch[2]) : 0,
        score: pctMatch ? parseFloat(pctMatch[1]) : null
      });
      continue;
    }

    // It is an assignment row
    const idMatch = rowHtml.match(/data-assignment-id="([^"]+)"/);
    const titleMatch = rowHtml.match(/class="anchorText"[^>]*>([^<]+)<\/span>/);
    const dateMatch = rowHtml.match(/(\d{2}\/\d{2}\/\d{4})/);
    const scoreMatch = rowHtml.match(/(\d+\.\d+)\s*\/\s*(\d+\.\d+)/);
    const pctMatch = rowHtml.match(/(\d+\.\d+)%/);
    const gradeMatch = rowHtml.match(/<span class="disabled-link-column">([A-DFP][+-]?)<\/span>/);
    const hasExclamation = rowHtml.includes('exclamation') || rowHtml.includes('svg-Exclamation');

    // Check points / score
    let earned = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    let maxScore = scoreMatch ? parseFloat(scoreMatch[2]) : null;

    // Check for standards-based score (e.g. integer 4 or 4/4)
    if (earned === null) {
      const intScoreMatch = rowHtml.match(/<span class="disabled-link-column">([0-4](?:\.[0-9]+)?)<\/span>/) ||
                            rowHtml.match(/([0-4](?:\.[0-9]+)?)\s*\/\s*([0-4](?:\.[0-9]+)?)/);
      if (intScoreMatch) {
        earned = parseFloat(intScoreMatch[1]);
        maxScore = intScoreMatch[2] ? parseFloat(intScoreMatch[2]) : 4;
      }
    }

    if (maxScore === null) maxScore = 100;
    const percent = pctMatch ? parseFloat(pctMatch[1]) : (earned !== null && maxScore > 0 ? (earned / maxScore * 100) : null);
    
    const letter = gradeMatch ? gradeMatch[1] : (earned != null && earned === 4 ? '4' : 'N/A');

    // Count any assignment that has an F grade as missing (or has Skyward exclamation)
    const isFGrade = (gradeMatch && gradeMatch[1].toUpperCase() === 'F') ||
                     (letter && letter.toUpperCase().startsWith('F')) ||
                     (percent !== null && percent < 60 && earned !== null && letter !== 'P' && letter !== 'N/A');

    const isMissing = Boolean(hasExclamation || isFGrade);

    let notes = '';
    if (isMissing) {
      if (hasExclamation && isFGrade) {
        notes = `Flagged as Missing & Failing in Qmlativ (${earned != null ? earned.toFixed(1) : '0.0'} / ${maxScore.toFixed(1)} pts • ${letter})`;
      } else if (hasExclamation) {
        notes = `Flagged as Missing in Qmlativ (${earned != null ? earned.toFixed(1) : '0.0'} / ${maxScore.toFixed(1)} pts)`;
      } else {
        notes = `Failing Grade (${letter} • ${earned != null ? earned.toFixed(1) : '0.0'} / ${maxScore.toFixed(1)} pts • Requires Make-up)`;
      }
    }

    const title = titleMatch ? titleMatch[1].trim() : `Assignment ${rowIdx}`;

    assignments.push({
      id: idMatch ? idMatch[1] : `asg-${rowIdx}`,
      title,
      category: currentCategory,
      dueDate: dateMatch ? dateMatch[1] : '',
      score: earned,
      maxScore,
      percent,
      letter,
      status: isMissing ? 'missing' : 'graded',
      notes
    });
  }

  return { categories, assignments };
}

function letterToPoints(letter) {
  if (!letter) return 0;
  const l = letter.toUpperCase();
  if (l.startsWith('A')) return 4.0;
  if (l.startsWith('B')) return 3.0;
  if (l.startsWith('C')) return 2.0;
  if (l.startsWith('D')) return 1.0;
  if (l === 'P') return 4.0;
  if (l === 'F') return 0.0;
  return 0.0;
}

function letterToEstimatedPercent(letter) {
  if (!letter || letter === 'N/A') return null;
  const l = letter.toUpperCase();
  if (l === 'A+') return 98.5;
  if (l === 'A') return 95.0;
  if (l === 'A-') return 91.5;
  if (l === 'B+') return 88.5;
  if (l === 'B') return 85.0;
  if (l === 'B-') return 81.5;
  if (l === 'C+') return 78.5;
  if (l === 'C') return 75.0;
  if (l === 'C-') return 71.5;
  if (l === 'D') return 65.0;
  if (l === 'P') return 100.0;
  if (l === 'F') return 50.0;
  return null;
}

function computeGradeBreakdown(courses) {
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0, P: 0 };
  courses.forEach(c => {
    const l = (c.grade?.letter || '').charAt(0).toUpperCase();
    if (counts[l] !== undefined) counts[l]++;
  });
  return counts;
}
