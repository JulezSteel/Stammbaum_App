// Person dedup/merge across documents. Person IDs are namespaced per document
// (docPrefix_person_N). A MergeMap redirects merged IDs to their canonical ID;
// canonical persons combine fields from all merged records.

import type { Person } from "./types";
import type { MergeMap } from "./db";

export function resolveId(id: string | null, map: MergeMap): string | null {
  if (!id) return null;
  let current = id;
  const seen = new Set<string>();
  while (map[current] && !seen.has(current)) {
    seen.add(current);
    current = map[current];
  }
  return current;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z]/g, "");
}

function yearOf(date: string | null): number | null {
  if (!date) return null;
  const m = date.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/** Combine all raw persons into canonical persons according to the merge map. */
export function canonicalPersons(rawPersons: Person[], map: MergeMap): Person[] {
  const groups = new Map<string, Person[]>();
  for (const p of rawPersons) {
    const cid = resolveId(p.id, map)!;
    const g = groups.get(cid) ?? [];
    g.push(p);
    groups.set(cid, g);
  }

  const result: Person[] = [];
  for (const [cid, members] of groups) {
    // The record whose own id is canonical leads; others fill gaps.
    const lead = members.find((m) => m.id === cid) ?? members[0];
    const pick = <K extends keyof Person>(key: K): Person[K] => {
      for (const m of [lead, ...members]) {
        const v = m[key];
        if (v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) return v;
      }
      return lead[key];
    };
    const fatherId = members.map((m) => m.parents.father_id).find(Boolean) ?? null;
    const motherId = members.map((m) => m.parents.mother_id).find(Boolean) ?? null;

    const partners = new Map<string, { person_id: string; marriage_date: string | null }>();
    for (const m of members) {
      for (const pt of m.partners) {
        const pid = resolveId(pt.person_id, map)!;
        const existing = partners.get(pid);
        if (!existing || (!existing.marriage_date && pt.marriage_date)) {
          partners.set(pid, { person_id: pid, marriage_date: pt.marriage_date });
        }
      }
    }

    result.push({
      id: cid,
      first_names: pick("first_names"),
      last_name: pick("last_name"),
      birth_name: pick("birth_name"),
      birth_date: pick("birth_date"),
      birth_place: pick("birth_place"),
      death_date: pick("death_date"),
      death_place: pick("death_place"),
      occupation: pick("occupation"),
      religion: pick("religion"),
      parents: {
        father_id: resolveId(fatherId, map),
        mother_id: resolveId(motherId, map),
      },
      partners: [...partners.values()].filter((pt) => pt.person_id !== cid),
      sources: [...new Set(members.flatMap((m) => m.sources))],
    });
  }
  return result;
}

export interface DuplicateSuggestion {
  a: Person;
  b: Person;
  reason: string;
}

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

/** Fuzzy name equality that tolerates OCR/spelling variants (Corsilius↔Corzilius). */
function nameSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  const d = levenshtein(a, b);
  if (maxLen >= 8) return d <= 2;
  if (maxLen >= 5) return d <= 1;
  return false;
}

/** Normalized, deduped surnames of a person (family name + maiden name). */
function surnames(p: Person): string[] {
  return [...new Set([p.last_name, p.birth_name].map((s) => normalize(s || "")).filter(Boolean))];
}

/** Suggest likely duplicates among canonical persons (fuzzy name + compatible dates). */
export function findDuplicates(persons: Person[]): DuplicateSuggestion[] {
  const scored: (DuplicateSuggestion & { score: number })[] = [];
  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const a = persons[i];
      const b = persons[j];

      const surA = surnames(a);
      const surB = surnames(b);
      if (!surA.length || !surB.length) continue;
      // A shared surname OR shared maiden name (fuzzy) is required.
      const exactSurname = surA.some((s) => surB.includes(s));
      const surnameMatch = surA.some((sa) => surB.some((sb) => nameSimilar(sa, sb)));
      if (!surnameMatch) continue;

      const firstA = a.first_names.map(normalize).filter(Boolean);
      const firstB = b.first_names.map(normalize).filter(Boolean);
      if (!firstA.length || !firstB.length) continue;
      const sharedFirst = firstA.some((fa) => firstB.some((fb) => nameSimilar(fa, fb)));
      if (!sharedFirst) continue;

      const yA = yearOf(a.birth_date);
      const yB = yearOf(b.birth_date);
      if (yA !== null && yB !== null && Math.abs(yA - yB) > 2) continue;

      // Same maiden name is the strongest single signal.
      const maidenMatch =
        !!a.birth_name && !!b.birth_name &&
        nameSimilar(normalize(a.birth_name), normalize(b.birth_name));

      let score = 0;
      if (exactSurname) score += 2;
      if (maidenMatch) score += 3;
      if (yA !== null && yB !== null && yA === yB) score += 2;
      if (yA !== null && yB !== null && Math.abs(yA - yB) <= 2) score += 1;

      const bits: string[] = [exactSurname ? "gleicher Name" : "ähnlicher Name"];
      if (maidenMatch) bits.push("gleicher Geburtsname");
      if (yA !== null && yB !== null) bits.push(`Geburtsjahr ${yA}/${yB}`);

      scored.push({ a, b, reason: bits.join(", "), score });
    }
  }
  // Strongest matches first.
  return scored.sort((x, y) => y.score - x.score).map(({ a, b, reason }) => ({ a, b, reason }));
}

/** Merge person b into person a: returns updated merge map. */
export function mergePersons(map: MergeMap, keepId: string, mergeId: string): MergeMap {
  if (keepId === mergeId) return map;
  return { ...map, [mergeId]: keepId };
}
