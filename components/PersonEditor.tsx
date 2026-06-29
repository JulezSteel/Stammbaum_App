"use client";

import { useState } from "react";
import type { Person } from "@/lib/types";

interface Props {
  person: Person;
  allPersons: Person[];
  onChange: (updated: Person) => void;
  onDelete: () => void;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
        {label}
      </label>
      <input
        className="border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        value={value}
        placeholder={placeholder ?? "–"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function PersonEditor({ person, allPersons, onChange, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true);

  const update = (patch: Partial<Person>) => onChange({ ...person, ...patch });

  const displayName = [
    person.first_names.join(" "),
    person.last_name,
  ]
    .filter(Boolean)
    .join(" ") || "Unbenannte Person";

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-amber-50 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">👤</span>
          <div>
            <p className="font-semibold text-stone-800">{displayName}</p>
            {person.birth_date && (
              <p className="text-xs text-stone-500">* {person.birth_date}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Löschen
          </button>
          <span className="text-stone-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white">
          {/* First names */}
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Vornamen
            </label>
            <input
              className="border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              value={person.first_names.join(", ")}
              placeholder="Vorname1, Vorname2"
              onChange={(e) =>
                update({
                  first_names: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <p className="text-xs text-stone-400">Durch Komma trennen</p>
          </div>

          <Field
            label="Nachname"
            value={person.last_name}
            onChange={(v) => update({ last_name: v })}
          />
          <Field
            label="Geburtsname"
            value={person.birth_name ?? ""}
            onChange={(v) => update({ birth_name: v || null })}
            placeholder="nur falls abweichend"
          />
          <Field
            label="Geburtsdatum"
            value={person.birth_date ?? ""}
            onChange={(v) => update({ birth_date: v || null })}
            placeholder="TT.MM.JJJJ"
          />
          <Field
            label="Geburtsort"
            value={person.birth_place ?? ""}
            onChange={(v) => update({ birth_place: v || null })}
          />
          <Field
            label="Sterbedatum"
            value={person.death_date ?? ""}
            onChange={(v) => update({ death_date: v || null })}
            placeholder="TT.MM.JJJJ"
          />
          <Field
            label="Sterbeort"
            value={person.death_place ?? ""}
            onChange={(v) => update({ death_place: v || null })}
          />
          <Field
            label="Beruf"
            value={person.occupation ?? ""}
            onChange={(v) => update({ occupation: v || null })}
          />
          <Field
            label="Konfession"
            value={person.religion ?? ""}
            onChange={(v) => update({ religion: v || null })}
          />

          {/* Parents */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Vater (ID)
            </label>
            <select
              className="border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              value={person.parents.father_id ?? ""}
              onChange={(e) =>
                update({ parents: { ...person.parents, father_id: e.target.value || null } })
              }
            >
              <option value="">– keiner –</option>
              {allPersons
                .filter((p) => p.id !== person.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {[...p.first_names, p.last_name].join(" ")} ({p.id})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Mutter (ID)
            </label>
            <select
              className="border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              value={person.parents.mother_id ?? ""}
              onChange={(e) =>
                update({ parents: { ...person.parents, mother_id: e.target.value || null } })
              }
            >
              <option value="">– keine –</option>
              {allPersons
                .filter((p) => p.id !== person.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {[...p.first_names, p.last_name].join(" ")} ({p.id})
                  </option>
                ))}
            </select>
          </div>

          {/* Sources */}
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Quellen
            </label>
            <input
              className="border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              value={person.sources.join("; ")}
              placeholder="Quelle1; Quelle2"
              onChange={(e) =>
                update({
                  sources: e.target.value
                    .split(";")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
