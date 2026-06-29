"use client";

import { useCallback, useRef, useState } from "react";
import type { UploadedDocument, TranscriptionResult } from "@/lib/types";

interface Props {
  onDocumentAdded: (doc: UploadedDocument, file: File) => void;
  onDocumentUpdated: (id: string, updates: Partial<UploadedDocument>) => void;
}

const CONCURRENCY = 2;

/** Prefix per-document person IDs so they never collide across documents,
 *  and rewrite all internal references (parents, partners, events). */
function namespaceIds(result: TranscriptionResult, docId: string): TranscriptionResult {
  const prefix = docId.slice(0, 8);
  const idMap = new Map(result.persons.map((p) => [p.id, `${prefix}_${p.id}`]));
  const remap = (id: string | null) => (id ? idMap.get(id) ?? id : null);
  return {
    ...result,
    persons: result.persons.map((p) => ({
      ...p,
      id: idMap.get(p.id)!,
      parents: {
        father_id: remap(p.parents.father_id),
        mother_id: remap(p.parents.mother_id),
      },
      partners: p.partners.map((pt) => ({ ...pt, person_id: remap(pt.person_id)! })),
    })),
    events: (result.events ?? []).map((e) => ({
      ...e,
      person_ids: e.person_ids.map((id) => idMap.get(id) ?? id),
    })),
  };
}

export default function UploadZone({ onDocumentAdded, onDocumentUpdated }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [queueInfo, setQueueInfo] = useState({ pending: 0, active: 0 });
  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const activeRef = useRef(0);

  const pump = useCallback(() => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const { id, file } = queueRef.current.shift()!;
      activeRef.current++;
      setQueueInfo({ pending: queueRef.current.length, active: activeRef.current });
      onDocumentUpdated(id, { status: "transcribing" });

      (async () => {
        try {
          const formData = new FormData();
          formData.append("files", file);
          formData.append("filename", file.name);
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          const json = await res.json();
          if (!res.ok) {
            onDocumentUpdated(id, { status: "error", error: json.error });
          } else {
            onDocumentUpdated(id, {
              status: "done",
              result: namespaceIds(json.result, id),
            });
          }
        } catch (err) {
          onDocumentUpdated(id, {
            status: "error",
            error: err instanceof Error ? err.message : "Netzwerkfehler",
          });
        } finally {
          activeRef.current--;
          setQueueInfo({ pending: queueRef.current.length, active: activeRef.current });
          pump();
        }
      })();
    }
  }, [onDocumentUpdated]);

  const processFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(
        (f) => f.type.startsWith("image/") || f.type === "application/pdf"
      );
      for (const file of accepted) {
        const isPdf = file.type === "application/pdf";
        const id = crypto.randomUUID();
        onDocumentAdded(
          {
            id,
            filename: file.name,
            // PDFs have no inline image preview; the card shows a placeholder.
            preview_url: isPdf ? "" : URL.createObjectURL(file),
            status: "pending",
          },
          file
        );
        queueRef.current.push({ id, file });
      }
      pump();
    },
    [onDocumentAdded, pump]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(Array.from(e.target.files));
      e.target.value = "";
    },
    [processFiles]
  );

  const busy = queueInfo.active > 0 || queueInfo.pending > 0;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
        ${isDragging
          ? "border-amber-500 bg-amber-50"
          : "border-stone-300 bg-stone-50 hover:border-amber-400 hover:bg-amber-50"
        }`}
    >
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={onInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="pointer-events-none">
        <div className="text-5xl mb-4">📜</div>
        <p className="text-stone-600 text-lg font-medium">
          Dokumente hier ablegen oder klicken zum Auswählen
        </p>
        <p className="text-stone-400 text-sm mt-2">
          JPG, PNG, WEBP, PDF – auch große Stapel möglich, Verarbeitung läuft automatisch
        </p>
        {busy && (
          <p className="text-amber-700 text-sm mt-3 font-medium">
            ⏳ {queueInfo.active} in Arbeit, {queueInfo.pending} wartend
          </p>
        )}
      </div>
    </div>
  );
}
