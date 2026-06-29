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

/** Suggest likely duplicates among canonical persons (same name, compatible dates). */
export function findDuplicates(persons: Person[]): DuplicateSuggestion[] {
  const suggestions: DuplicateSuggestion[] = [];
  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const a = persons[i];
      const b = persons[j];
      const lastA = normalize(a.last_name || a.birth_name || "");
      const lastB = normalize(b.last_name || b.birth_name || "");
      const birthNameMatch =
        (a.birth_name && normalize(a.birth_name) === lastB) ||
        (b.birth_name && normalize(b.birth_name) === lastA);
      if (!lastA || (lastA !== lastB && !birthNameMatch)) continue;

      const firstA = a.first_names.map(normalize);
      const firstB = b.first_names.map(normalize);
      if (!firstA.length || !firstB.length) continue;
      const sharedFirst = firstA.some((f) => firstB.includes(f));
      if (!sharedFirst) continue;

      const yA = yearOf(a.birth_date);
      const yB = yearOf(b.birth_date);
      if (yA !== null && yB !== null && Math.abs(yA - yB) > 2) continue;

      const reason =
        yA !== null && yB !== null
          ? `Gleicher Name, Geburtsjahr ${yA}/${yB}`
          : "Gleicher Name" + (birthNameMatch ? " (Geburtsname)" : "");
      suggestions.push({ a, b, reason });
    }
  }
  return suggestions;
}

/** Merge person b into person a: returns updated merge map. */
export function mergePersons(map: MergeMap, keepId: string, mergeId: string): MergeMap {
  if (keepId === mergeId) return map;
  return { ...map, [mergeId]: keepId };
}
