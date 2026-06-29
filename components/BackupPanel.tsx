"use client";

import { useRef, useState } from "react";
import { downloadBackup, restoreBackup } from "@/lib/backup";

interface Props {
  docCount: number;
  /** Called after a successful restore so the page can reload its state. */
  onRestored: () => void;
}

const LAST_BACKUP_KEY = "familienbaum:lastBackup";

export default function BackupPanel({ docCount, onRestored }: Props) {
  const [busy, setBusy] = useState<null | "export" | "import">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lastBackup =
    typeof window !== "undefined" ? localStorage.getItem(LAST_BACKUP_KEY) : null;

  const handleExport = async () => {
    setBusy("export");
    setMessage(null);
    try {
      const n = await downloadBackup();
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      setMessage({ kind: "ok", text: `Sicherung mit ${n} Dokument(en) heruntergeladen.` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Sicherung fehlgeschlagen." });
    } finally {
      setBusy(null);
    }
  };

  const handleImportFile = async (file: File) => {
    if (
      docCount > 0 &&
      !confirm(
        "Eine Sicherung wiederherzustellen ersetzt ALLE aktuell vorhandenen Dokumente und Personen. Fortfahren?"
      )
    ) {
      return;
    }
    setBusy("import");
    setMessage(null);
    try {
      const text = await file.text();
      const res = await restoreBackup(text);
      setMessage({
        kind: "ok",
        text: `${res.documents} Dokument(e) und ${res.persons} Person(en) wiederhergestellt.`,
      });
      onRestored();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Wiederherstellung fehlgeschlagen." });
    } finally {
      setBusy(null);
    }
  };

  const lastBackupLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-700">Sicherung &amp; Wiederherstellung</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Lädt den kompletten Bestand (Dokumente, Personen, Bilder) als eine Datei
            herunter – als Schutz vor Datenverlust und zum Übertragen auf einen anderen Rechner.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          disabled={busy !== null || docCount === 0}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {busy === "export" ? "Sichere…" : "💾 Sicherung herunterladen"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm hover:bg-stone-200 disabled:opacity-40 transition-colors font-medium"
        >
          {busy === "import" ? "Stelle wieder her…" : "↥ Sicherung wiederherstellen"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <p className="text-xs text-stone-400">
        {lastBackupLabel
          ? `Letzte Sicherung: ${lastBackupLabel}`
          : "Noch keine Sicherung erstellt – am besten gleich eine herunterladen."}
      </p>
    </div>
  );
}
