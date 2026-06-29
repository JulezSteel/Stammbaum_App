// Full-state backup & restore. Unlike the genealogy exports (GEDCOM/CSV/JSON of
// persons), this captures everything needed to fully reconstruct the workspace
// in another browser: all documents (raw text, persons, status), the merge map,
// and the downscaled preview images. One file = a complete, restorable copy.

import {
  loadDocuments, saveDocument, clearDocuments,
  loadMergeMap, saveMergeMap,
  type StoredDocument, type MergeMap,
} from "./db";

const BACKUP_APP = "familienbaum";
const BACKUP_VERSION = 1;

interface BackupDocument extends Omit<StoredDocument, "previewBlob"> {
  previewDataUrl?: string;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  documents: BackupDocument[];
  mergeMap: MergeMap;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Build a complete backup object from current IndexedDB state. */
export async function buildBackup(): Promise<BackupFile> {
  const [docs, mergeMap] = await Promise.all([loadDocuments(), loadMergeMap()]);
  const documents: BackupDocument[] = await Promise.all(
    docs.map(async ({ previewBlob, ...rest }) => ({
      ...rest,
      previewDataUrl: previewBlob ? await blobToDataUrl(previewBlob) : undefined,
    }))
  );
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    documents,
    mergeMap,
  };
}

/** Trigger a download of the full backup as a .json file. */
export async function downloadBackup(): Promise<number> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `familienbaum_sicherung_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return backup.documents.length;
}

export interface RestoreResult {
  documents: number;
  persons: number;
}

/** Replace all current data with the contents of a backup file. */
export async function restoreBackup(text: string): Promise<RestoreResult> {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Datei ist kein gültiges JSON.");
  }
  if (parsed.app !== BACKUP_APP || !Array.isArray(parsed.documents)) {
    throw new Error("Das ist keine Familienbaum-Sicherungsdatei.");
  }

  await clearDocuments();
  let persons = 0;
  for (const { previewDataUrl, ...rest } of parsed.documents) {
    const doc: StoredDocument = {
      ...rest,
      previewBlob: previewDataUrl ? await dataUrlToBlob(previewDataUrl) : undefined,
    };
    persons += doc.result?.persons?.length ?? 0;
    await saveDocument(doc);
  }
  await saveMergeMap(parsed.mergeMap ?? {});

  return { documents: parsed.documents.length, persons };
}
