import { NextRequest, NextResponse } from "next/server";
import { anthropic, TRANSCRIPTION_SYSTEM_PROMPT } from "@/lib/anthropic";
import type { TranscriptionResult } from "@/lib/types";

export const maxDuration = 60;

/** Pull the JSON object out of a model reply that may include a preamble,
 *  trailing prose, or markdown code fences. */
function extractJson(text: string): string {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return t;
}

async function transcribeFile(
  sourceBlock: object,
  filename: string
): Promise<TranscriptionResult> {
  let lastErr: unknown;
  // Two attempts: the model occasionally wraps the JSON in prose; a retry with
  // robust extraction recovers nearly all of those cases.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: TRANSCRIPTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            sourceBlock as never,
            {
              type: "text" as const,
              text: `Bitte transkribiere dieses historische Dokument vollständig.${
                filename ? ` Dateiname: ${filename}` : ""
              } Antworte ausschließlich mit dem JSON-Objekt, ohne Einleitung.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      lastErr = new Error("Keine Textantwort von Claude erhalten");
      continue;
    }
    try {
      return JSON.parse(extractJson(textBlock.text)) as TranscriptionResult;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Antwort war kein gültiges JSON (${lastErr instanceof Error ? lastErr.message : "unbekannt"})`
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const filename = formData.get("filename") as string;

    if (!files.length) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const results: TranscriptionResult[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const isPdf = file.type === "application/pdf";
      const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      // Claude reads PDFs natively (document block) and images (image block).
      const sourceBlock = isPdf
        ? {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
          }
        : {
            type: "image" as const,
            source: { type: "base64" as const, media_type: mediaType, data: base64 },
          };

      const parsed = await transcribeFile(sourceBlock, filename);

      // Ensure sources reference the filename
      const sourceRef = file.name || filename || "Hochgeladenes Dokument";
      parsed.persons = (parsed.persons ?? []).map((p) => ({
        ...p,
        sources: p.sources?.length ? p.sources : [sourceRef],
      }));
      parsed.events = parsed.events ?? [];

      results.push(parsed);
    }

    // Merge multiple results if batch upload
    if (results.length === 1) {
      return NextResponse.json({ result: results[0] });
    }

    const merged: TranscriptionResult = {
      raw_text: results.map((r, i) => `=== Dokument ${i + 1} ===\n${r.raw_text}`).join("\n\n"),
      document_type: results.map((r) => r.document_type).join(", "),
      notes: results.map((r, i) => r.notes ? `[Dok. ${i + 1}] ${r.notes}` : "").filter(Boolean).join(" | "),
      events: results.flatMap((r) => r.events),
      persons: results.flatMap((r) => r.persons),
    };

    return NextResponse.json({ result: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Transcription error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
