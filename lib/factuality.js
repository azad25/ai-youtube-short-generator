export const CLAIM_CLASSIFICATIONS = ['CONFIRMED', 'REPORTED', 'RUMORED', 'THEORY', 'UNKNOWN', 'UNSUPPORTED'];

export function normalizeFact(input) {
  const classification = String(input.classification || 'UNKNOWN').toUpperCase();
  if (!CLAIM_CLASSIFICATIONS.includes(classification)) throw new Error('Invalid fact classification.');
  const sourceIds = [...new Set((input.sourceIds || []).map(String).filter(Boolean))];
  const confidence = Number(input.confidence ?? 0);
  if (!String(input.statement || '').trim()) throw new Error('Fact statement is required.');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Fact confidence must be between 0 and 1.');
  return { id: input.id || `FACT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, statement: String(input.statement).trim(), classification, sourceIds, confidence };
}

export function evidenceIssues(facts, minimumSources = 2) {
  const issues = [];
  for (const fact of facts) {
    if (fact.classification === 'CONFIRMED' && fact.sourceIds.length < minimumSources) issues.push(`${fact.id} is marked CONFIRMED but has fewer than ${minimumSources} sources.`);
    if (fact.classification === 'REPORTED' && fact.sourceIds.length < 1) issues.push(`${fact.id} is marked REPORTED without a source.`);
  }
  return issues;
}

export function reviewScriptClaims(claims, facts, minimumSources = 2) {
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const failures = [];
  const summary = { confirmed: 0, reported: 0, rumored: 0, theory: 0, unsupported: 0 };
  for (const claim of claims || []) {
    const classification = String(claim.classification || 'UNSUPPORTED').toUpperCase();
    const cited = (claim.evidence_ids || []).map((id) => factsById.get(id)).filter(Boolean);
    const citedIssues = evidenceIssues(cited, minimumSources);
    if (!CLAIM_CLASSIFICATIONS.includes(classification) || classification === 'UNKNOWN' || classification === 'UNSUPPORTED') {
      summary.unsupported += 1; failures.push(`Unsupported claim: ${claim.statement || 'unnamed claim'}.`); continue;
    }
    if (cited.length === 0 || citedIssues.length) { summary.unsupported += 1; failures.push(`Claim lacks sufficient evidence: ${claim.statement || 'unnamed claim'}.`); continue; }
    if (classification === 'CONFIRMED' && !cited.some((fact) => fact.classification === 'CONFIRMED')) { summary.unsupported += 1; failures.push(`Confirmed claim is not backed by confirmed evidence: ${claim.statement}.`); continue; }
    if (classification === 'REPORTED') summary.reported += 1;
    if (classification === 'RUMORED') summary.rumored += 1;
    if (classification === 'THEORY') summary.theory += 1;
    if (classification === 'CONFIRMED') summary.confirmed += 1;
  }
  return { passed: failures.length === 0 && (claims || []).length > 0, failures, summary, score: Math.max(0, 100 - failures.length * 25) };
}
