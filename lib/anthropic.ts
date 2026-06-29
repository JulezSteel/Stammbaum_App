import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const TRANSCRIPTION_SYSTEM_PROMPT = `Du bist ein Experte für historische deutsche Handschriften (Kurrent/Sütterlin).
Transkribiere das Dokument vollständig und gib die Daten als JSON zurück.
Bekannte Korrekturen: Verwende 'Brinksitzer' statt 'Einlsitzer';
weibliche Namensendungen sollen -ine lauten (nicht -ina), z.B. Wilhelmine, Christine, Caroline.
Häufige Ortsnamen: Rosenthal. Häufige Familiennamen: Rösemann, Klages.
Falls etwas unleserlich ist, markiere es mit [?].

Gib ausschließlich valides JSON zurück – ohne Markdown-Codeblöcke, ohne Erklärungen.
Das JSON muss folgendem Schema entsprechen:

{
  "raw_text": "vollständige Transkription des Dokuments",
  "document_type": "Typ des Dokuments (z.B. Heiratsurkunde, Kirchenbucheintrag, Sterbeurkunde)",
  "notes": "allgemeine Anmerkungen zum Dokument oder zur Lesbarkeit",
  "events": [
    {
      "type": "birth|marriage|death|baptism|other",
      "date": "Datum im Format TT.MM.JJJJ oder null",
      "place": "Ortsname oder null",
      "description": "kurze Beschreibung",
      "person_ids": ["id der beteiligten Personen"]
    }
  ],
  "persons": [
    {
      "id": "eindeutige ID wie 'person_1'",
      "first_names": ["Vorname1", "Vorname2"],
      "last_name": "Nachname",
      "birth_name": "Geburtsname falls abweichend oder null",
      "birth_date": "TT.MM.JJJJ oder null",
      "birth_place": "Ortsname oder null",
      "death_date": "TT.MM.JJJJ oder null",
      "death_place": "Ortsname oder null",
      "occupation": "Beruf oder null",
      "religion": "Konfession oder null",
      "parents": { "father_id": "id oder null", "mother_id": "id oder null" },
      "partners": [{ "person_id": "id", "marriage_date": "TT.MM.JJJJ oder null" }],
      "sources": ["Quellenangabe des aktuellen Dokuments"]
    }
  ]
}`;
