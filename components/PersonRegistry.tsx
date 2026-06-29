"use client";

import { useMemo, useState } from "react";
import type { Person } from "@/lib/types";
import { findDuplicates } from "@/lib/merge";

interface Props {
  persons: Person[]; // canonical persons
  onMerge: (keepId: string, mergeId: string) => void;
}

function displayName(p: Person): string {
  const name = `${p.first_names.join(" ")} ${p.last_name}`.trim();
  return name || "(unbenannt)";
}

function lifespan(p: Person): string {
  const b = p.birth_date ? `* ${p.birth_date}` : "";
  const d = p.death_date ? `† ${p.death_date}` : "";
  return [b, d].filter(Boolean).join("  ");
}

export default function PersonRegistry({ persons, onMerge }: Props) {
  const [search, setSearch] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const duplicates = useMemo(() => findDuplicates(persons), [persons]);
  const visibleDuplicates = duplicates.filter(
    (s) => !dismissed.has(`${s.a.id}|${s.b.id}`)
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return persons
      .filter(
        (p) =>
          !q ||
          displayName(p).toLowerCase().includes(q) ||
          (p.birth_place ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => displayName(a).localeCompare(displayName(b), "de"));
  }, [persons, search]);

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  return (
    <div className="space-y-6">
      {/* Duplicate suggestions */}
      {visibleDuplicates.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-amber-900">
            🔍 Mögliche Duplikate ({visibleDuplicates.length})
          </h3>
          <p className="text-xs text-amber-800">
            Dieselbe Person kann in mehreren Dokumenten auftauchen. Zusammenführen
            verbindet die Datensätze und ihre Beziehungen.
          </p>
          {visibleDuplicates.slice(0, 10).map((s) => (
            <div
              key={`${s.a.id}|${s.b.id}`}
              className="bg-white rounded-lg p-3 border border-amber-200 text-sm flex flex-wrap items-center gap-2"
            >
              <div className="flex-1 min-w-[200px]">
                <span className="font-medium">{displayName(s.a)}</span>
                <span className="text-stone-400 text-xs ml-2">{lifespan(s.a)}</span>
                <span className="mx-2 text-stone-300">↔</span>
                <span className="font-medium">{displayName(s.b)}</span>
                <span className="text-stone-400 text-xs ml-2">{lifespan(s.b)}</span>
                <p className="text-xs text-amber-700 mt-0.5">{s.reason}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onMerge(s.a.id, s.b.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium"
                >
                  Zusammenführen
                </button>
                <button
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(`${s.a.id}|${s.b.id}`))
                  }
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs"
                >
                  Verschiedene Personen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + list */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-stone-700">
            Alle Personen ({persons.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="flex-1 max-w-xs px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((p) => {
            const father = p.parents.father_id ? byId.get(p.parents.father_id) : null;
            const mother = p.parents.mother_id ? byId.get(p.parents.mother_id) : null;
            return (
              <div
                key={p.id}
                className="border border-stone-200 rounded-lg p-3 bg-white text-sm space-y-1"
              >
                <p className="font-semibold text-stone-800">{displayName(p)}</p>
                {p.birth_name && (
                  <p className="text-xs text-stone-500">geb. {p.birth_name}</p>
                )}
                <p className="text-xs text-stone-500">{lifespan(p)}</p>
                {(p.birth_place || p.occupation) && (
                  <p className="text-xs text-stone-400">
                    {[p.birth_place, p.occupation].filter(Boolean).join(" · ")}
                  </p>
                )}
                {(father || mother) && (
                  <p className="text-xs text-stone-400">
                    Eltern: {[father, mother].filter(Boolean).map((x) => displayName(x!)).join(" & ")}
                  </p>
                )}
                <p className="text-[10px] text-stone-300 truncate" title={p.sources.join(", ")}>
                  {p.sources.length} Quelle{p.sources.length !== 1 ? "n" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
