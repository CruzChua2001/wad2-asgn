import { gradeFor } from "@/components/grade-badge";

// Same maths as scoreOf in express-server/lib/score.js: a weighted average of the checks that ran,
// capped at 50 while a critical check scores 0
function scoreOf(checks) {
  const ran = checks.filter((check) => check.status === "ok");
  const totalWeight = ran.reduce((sum, check) => sum + check.weight, 0);
  const earned = ran.reduce((sum, check) => sum + check.weight * check.score, 0);

  const uncappedScore = totalWeight > 0 ? Math.round((10 * earned) / totalWeight) : 0;
  const capped = ran.some((check) => check.risk === "critical" && check.score === 0);
  const score = capped ? Math.min(50, uncappedScore) : uncappedScore;

  return { score, uncappedScore, capped };
}

// The score if every planned finding were fixed. A check only counts as fixed (10/10) when
// all of its findings are planned. Findings with no checkId never change the score.
export function projectScore(checks, findings, plannedIds) {
  const planned = new Set(plannedIds);
  const fixedCheckIds = [];
  const partialCheckIds = [];

  for (const check of checks) {
    if (check.status !== "ok") continue;

    const onCheck = findings.filter((finding) => finding.checkId === check.id);
    const picked = onCheck.filter((finding) => planned.has(finding.id));

    if (picked.length === 0) continue;
    if (picked.length === onCheck.length) {
      fixedCheckIds.push(check.id);
    } else {
      partialCheckIds.push(check.id);
    }
  }

  const fixed = checks.map((check) => (fixedCheckIds.includes(check.id) ? { ...check, score: 10 } : check));
  const before = scoreOf(checks);
  const after = scoreOf(fixed);

  return {
    score: after.score,
    uncappedScore: after.uncappedScore,
    capped: after.capped,
    grade: gradeFor(after.score),
    gain: after.score - before.score,
    fixedCheckIds,
    partialCheckIds,
  };
}
