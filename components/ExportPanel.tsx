"use client";

import type { Person } from "@/lib/types";
import { toGedcom } from "@/lib/gedcom";

interface Props {
  persons: Person[];
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({ persons }: Props) {
  if (persons.length === 0) return null;

  const date = new Date().toISOString().slice(0, 10);

  const downloadJson = () =>
    download(JSON.stringify(persons, null, 2), `familiendaten_${date}.json`, "application/json");

  const downloadGedcom = () =>
    download(toGedcom(persons), `familienbaum_${date}.ged`, "text/plain;charset=utf-8");

  const downloadCsv = () => {
    const headers = ["ID","Vornamen","Nachname","Geburtsname","Geburtsdatum","Geburtsort","Sterbedatum","Sterbeort","Beruf","Konfession","Vater-ID","Mutter-ID","Quellen"];
    const rows = persons.map((p) => [
      p.id, p.first_names.join(" "), p.last_name, p.birth_name ?? "",
      p.birth_date ?? "", p.birth_place ?? "", p.death_date ?? "", p.death_place ?? "",
      p.occupation ?? "", p.religion ?? "",
      p.parents.father_id ?? "", p.parents.mother_id ?? "", p.sources.join("; "),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    download("﻿" + csv, `familiendaten_${date}.csv`, "text/csv;charset=utf-8;");
  };

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-white shadow-sm">
      <h2 className="font-semibold text-stone-700 mb-3">
        Export ({persons.length} {persons.length === 1 ? "Person" : "Personen"})
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={downloadGedcom}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors font-medium"
        >
          ↓ GEDCOM (.ged)
        </button>
        <button
          onClick={downloadJson}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 transition-colors font-medium"
        >
          ↓ JSON
        </button>
        <button
          onClick={downloadCsv}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500 transition-colors font-medium"
        >
          ↓ CSV
        </button>
      </div>
      <p className="text-xs text-stone-400 mt-2">
        GEDCOM ist das Standardformat für Genealogie-Software (Ahnenblatt, Gramps,
        MyHeritage). JSON enthält die vollständige Datenstruktur, CSV ist für Tabellen.
      </p>
    </div>
  );
}
