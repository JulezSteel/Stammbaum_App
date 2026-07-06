"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UploadedDocument, Person } from "@/lib/types";
import {
  loadDocuments, saveDocument, deleteDocument, clearDocuments,
  loadMergeMap, saveMergeMap, makePreviewBlob,
  type StoredDocument, type MergeMap,
} from "@/lib/db";
import { canonicalPersons, mergePersons } from "@/lib/merge";
import { restoreBackup } from "@/lib/backup";
import UploadZone from "@/components/UploadZone";
import DocumentCard from "@/components/DocumentCard";
import ExportPanel from "@/components/ExportPanel";
import BackupPanel from "@/components/BackupPanel";
import PersonRegistry from "@/components/PersonRegistry";
import FamilyTree from "@/components/FamilyTree";

type Tab = "dokumente" | "personen" | "stammbaum";

export default function Home() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [mergeMap, setMergeMap] = useState<MergeMap>({});
  const [tab, setTab] = useState<Tab>("dokumente");
  const [loaded, setLoaded] = useState(false);

  // Restore from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const [stored, map] = await Promise.all([loadDocuments(), loadMergeMap()]);
        const restored: UploadedDocument[] = stored.map((d) => {
          const { previewBlob, createdAt, ...rest } = d;
          void createdAt;
          const doc: UploadedDocument = {
            ...rest,
            preview_url: previewBlob ? URL.createObjectURL(previewBlob) : "",
          };
          // Uploads interrupted by closing the browser cannot resume (file is gone)
          if (doc.status === "pending" || doc.status === "transcribing") {
            doc.status = "error";
            doc.error = "Unterbrochen – Datei bitte erneut hochladen";
          }
          return doc;
        });
        setDocuments(restored);
        setMergeMap(map);
      } catch (e) {
        console.error("IndexedDB restore failed:", e);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((doc: UploadedDocument, previewBlob?: Blob) => {
    const { preview_url, ...rest } = doc;
    void preview_url;
    const stored: StoredDocument = { ...rest, previewBlob, createdAt: Date.now() };
    saveDocument(stored).catch((e) => console.error("Persist failed:", e));
  }, []);

  const addDocument = useCallback(
    (doc: UploadedDocument, file: File) => {
      setDocuments((prev) => [...prev, doc]);
      makePreviewBlob(file)
        .then((blob) => persist(doc, blob))
        .catch(() => persist(doc));
    },
    [persist]
  );

  const updateDocument = useCallback((id: string, updates: Partial<UploadedDocument>) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...updates };
        // Re-persist with existing preview: fetch blob back from object URL is wasteful;
        // instead update only the data fields and keep the stored blob.
        loadDocuments().then((stored) => {
          const existing = stored.find((s) => s.id === id);
          const { preview_url, ...rest } = next;
          void preview_url;
          saveDocument({
            ...rest,
            previewBlob: existing?.previewBlob,
            createdAt: existing?.createdAt ?? Date.now(),
          }).catch(() => {});
        });
        return next;
      })
    );
  }, []);

  const updatePersons = useCallback(
    (docId: string, persons: Person[]) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId || !d.result) return d;
          const next = { ...d, result: { ...d.result, persons } };
          loadDocuments().then((stored) => {
            const existing = stored.find((s) => s.id === docId);
            const { preview_url, ...rest } = next;
            void preview_url;
            saveDocument({
              ...rest,
              previewBlob: existing?.previewBlob,
              createdAt: existing?.createdAt ?? Date.now(),
            }).catch(() => {});
          });
          return next;
        })
      );
    },
    []
  );

  // A backup .json dropped onto / picked in the upload zone restores the workspace,
  // rather than being (wrongly) treated as a document to transcribe.
  const handleBackupFile = useCallback(
    async (file: File) => {
      if (
        documents.length > 0 &&
        !confirm(
          "Das ist eine Sicherungsdatei. Wiederherstellen ersetzt ALLE aktuell vorhandenen Dokumente und Personen. Fortfahren?"
        )
      ) {
        return;
      }
      try {
        await restoreBackup(await file.text());
        window.location.reload();
      } catch (e) {
        alert(
          "Wiederherstellung fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannter Fehler")
        );
      }
    },
    [documents.length]
  );

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    deleteDocument(id).catch(() => {});
  }, []);

  const removeAll = useCallback(() => {
    if (!confirm("Wirklich alle Dokumente und Personen löschen?")) return;
    setDocuments([]);
    setMergeMap({});
    clearDocuments().catch(() => {});
    saveMergeMap({}).catch(() => {});
  }, []);

  const handleMerge = useCallback((keepId: string, mergeId: string) => {
    setMergeMap((prev) => {
      const next = mergePersons(prev, keepId, mergeId);
      saveMergeMap(next).catch(() => {});
      return next;
    });
  }, []);

  const rawPersons = useMemo(
    () =>
      documents
        .filter((d) => d.status === "done")
        .flatMap((d) => d.result?.persons ?? []),
    [documents]
  );

  const persons = useMemo(
    () => canonicalPersons(rawPersons, mergeMap),
    [rawPersons, mergeMap]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "dokumente", label: `📄 Dokumente (${documents.length})` },
    { key: "personen", label: `👥 Personen (${persons.length})` },
    { key: "stammbaum", label: "🌳 Stammbaum" },
  ];

  if (!loaded) {
    return (
      <div className="text-center py-24 text-stone-300">
        <div className="w-8 h-8 mx-auto border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border
              ${tab === t.key
                ? "bg-white border-stone-200 border-b-white text-amber-700"
                : "bg-transparent border-transparent text-stone-400 hover:text-stone-600"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dokumente" && (
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-stone-800">
              Alte Familiendokumente transkribieren
            </h2>
            <p className="text-stone-500 max-w-xl mx-auto text-sm">
              Fotos hochladen → Claude liest Kurrent/Sütterlin → Personen werden
              automatisch gesammelt und im Stammbaum verknüpft. Alles wird lokal
              im Browser gespeichert.
            </p>
          </div>

          <UploadZone
            onDocumentAdded={addDocument}
            onDocumentUpdated={updateDocument}
            onBackupFile={handleBackupFile}
          />

          {documents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-stone-700 text-lg">
                  Dokumente ({documents.length})
                </h2>
                <button
                  onClick={removeAll}
                  className="text-xs text-stone-400 hover:text-red-500 underline underline-offset-2 transition-colors"
                >
                  Alle entfernen
                </button>
              </div>
              <div className="space-y-6">
                {documents.map((doc) => (
                  <div key={doc.id} className="relative">
                    <button
                      onClick={() => removeDocument(doc.id)}
                      title="Dokument entfernen"
                      className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-stone-200 hover:bg-red-100 hover:text-red-600 text-stone-500 text-xs flex items-center justify-center shadow transition-colors"
                    >
                      ×
                    </button>
                    <DocumentCard doc={doc} onPersonsChange={updatePersons} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {documents.length === 0 && (
            <div className="text-center py-16 text-stone-300 space-y-2">
              <p className="text-5xl">📄</p>
              <p className="text-sm">Noch keine Dokumente hochgeladen</p>
            </div>
          )}
        </div>
      )}

      {tab === "personen" && (
        <div className="space-y-6">
          <ExportPanel persons={persons} />
          <BackupPanel docCount={documents.length} onRestored={() => window.location.reload()} />
          <PersonRegistry persons={persons} onMerge={handleMerge} />
        </div>
      )}

      {tab === "stammbaum" && <FamilyTree persons={persons} />}
    </div>
  );
}
