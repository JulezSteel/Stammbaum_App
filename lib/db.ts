// IndexedDB persistence — documents (incl. preview image) and merge map survive reloads.

import type { UploadedDocument } from "./types";

const DB_NAME = "familienbaum";
const DB_VERSION = 1;

export interface StoredDocument extends Omit<UploadedDocument, "preview_url"> {
  previewBlob?: Blob;
  createdAt: number;
}

/** mergedPersonId -> canonicalPersonId */
export type MergeMap = Record<string, string>;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function saveDocument(doc: StoredDocument): Promise<void> {
  await tx("documents", "readwrite", (s) => s.put(doc));
}

export async function deleteDocument(id: string): Promise<void> {
  await tx("documents", "readwrite", (s) => s.delete(id));
}

export async function loadDocuments(): Promise<StoredDocument[]> {
  const docs = await tx<StoredDocument[]>("documents", "readonly", (s) => s.getAll());
  return docs.sort((a, b) => a.createdAt - b.createdAt);
}

export async function clearDocuments(): Promise<void> {
  await tx("documents", "readwrite", (s) => s.clear());
}

export async function saveMergeMap(map: MergeMap): Promise<void> {
  await tx("meta", "readwrite", (s) => s.put(map, "mergeMap"));
}

export async function loadMergeMap(): Promise<MergeMap> {
  const map = await tx<MergeMap | undefined>("meta", "readonly", (s) => s.get("mergeMap"));
  return map ?? {};
}

/** Downscale an image file to a max edge for storage-friendly previews. */
export async function makePreviewBlob(file: File, maxEdge = 1000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85)
  );
}
