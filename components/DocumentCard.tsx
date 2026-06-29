"use client";

import { useState } from "react";
import type { UploadedDocument, Person } from "@/lib/types";
import PersonEditor from "./PersonEditor";

interface Props {
  doc: UploadedDocument;
  onPersonsChange: (docId: string, persons: Person[]) => void;
}

export default function DocumentCard({ doc, onPersonsChange }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);

  const persons = doc.result?.persons ?? [];

  const updatePerson = (index: number, updated: Person) => {
    const next = persons.map((p, i) => (i === index ? updated : p));
    onPersonsChange(doc.id, next);
  };

  const deletePerson = (index: number) => {
    const next = persons.filter((_, i) => i !== index);
    onPersonsChange(doc.id, next);
  };

  const addPerson = () => {
    const next: Person = {
      id: `person_${Date.now()}`,
      first_names: [],
      last_name: "",
      birth_name: null,
      birth_date: null,
      birth_place: null,
      death_date: null,
      death_place: null,
      occupation: null,
      religion: null,
      parents: { father_id: null, mother_id: null },
      partners: [],
      sources: [doc.filename],
    };
    onPersonsChange(doc.id, [...persons, next]);
  };

  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-md bg-white">
      {/* Document header */}
      <div className="flex items-start gap-4 p-4 bg-parchment-50 border-b border-stone-200">
        {/* Thumbnail (image) or placeholder (PDF / no preview) */}
        {doc.preview_url ? (
          <img
            src={doc.preview_url}
            alt={doc.filename}
            className={`rounded-lg border border-stone-200 shadow-sm cursor-pointer transition-all object-cover
              ${imgExpanded ? "w-full max-w-sm h-auto" : "w-20 h-20"}`}
            onClick={() => setImgExpanded((v) => !v)}
          />
        ) : (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg border border-stone-200 shadow-sm bg-stone-50 flex flex-col items-center justify-center text-stone-400">
            <span className="text-2xl leading-none">📄</span>
            <span className="text-[9px] font-semibold mt-1 tracking-wide">PDF</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-800 truncate">{doc.filename}</p>
          {doc.result && (
            <p className="text-xs text-amber-700 font-medium mt-0.5">
              {doc.result.document_type}
            </p>
          )}
          <StatusBadge status={doc.status} />
          {doc.error && (
            <p className="text-xs text-red-600 mt-1">{doc.error}</p>
          )}
        </div>
      </div>

      {/* Result area */}
      {doc.status === "done" && doc.result && (
        <div className="p-4 space-y-4">
          {/* Notes */}
          {doc.result.notes && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-900 border border-amber-100">
              <span className="font-semibold">Anmerkungen: </span>
              {doc.result.notes}
            </div>
          )}

          {/* Raw text toggle */}
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2"
          >
            {showRaw ? "Rohtext ausblenden" : "Rohtranskription anzeigen"}
          </button>
          {showRaw && (
            <pre className="text-xs bg-stone-50 rounded-lg p-3 border border-stone-200 whitespace-pre-wrap font-mono overflow-x-auto max-h-60 overflow-y-auto">
              {doc.result.raw_text}
            </pre>
          )}

          {/* Persons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-700">
                Personen ({persons.length})
              </h3>
              <button
                onClick={addPerson}
                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                + Person hinzufügen
              </button>
            </div>
            {persons.length === 0 ? (
              <p className="text-sm text-stone-400 italic">
                Keine Personen erkannt
              </p>
            ) : (
              persons.map((p, i) => (
                <PersonEditor
                  key={p.id}
                  person={p}
                  allPersons={persons}
                  onChange={(updated) => updatePerson(i, updated)}
                  onDelete={() => deletePerson(i)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {doc.status === "transcribing" && (
        <div className="p-8 flex flex-col items-center gap-3 text-stone-400">
          <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-sm">Transkribiere mit Claude…</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UploadedDocument["status"] }) {
  const map: Record<UploadedDocument["status"], { label: string; cls: string }> = {
    pending: { label: "Wartend", cls: "bg-stone-100 text-stone-500" },
    transcribing: { label: "Wird transkribiert…", cls: "bg-blue-100 text-blue-700 animate-pulse" },
    done: { label: "Fertig", cls: "bg-green-100 text-green-700" },
    error: { label: "Fehler", cls: "bg-red-100 text-red-700" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${cls}`}>
      {label}
    </span>
  );
}
