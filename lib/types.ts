export interface Partner {
  person_id: string;
  marriage_date: string | null;
}

export interface Person {
  id: string;
  first_names: string[];
  last_name: string;
  birth_name: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  occupation: string | null;
  religion: string | null;
  parents: {
    father_id: string | null;
    mother_id: string | null;
  };
  partners: Partner[];
  sources: string[];
}

export interface TranscriptionResult {
  raw_text: string;
  document_type: string;
  persons: Person[];
  events: DocumentEvent[];
  notes: string;
}

export interface DocumentEvent {
  type: "birth" | "marriage" | "death" | "baptism" | "other";
  date: string | null;
  place: string | null;
  description: string;
  person_ids: string[];
}

export interface UploadedDocument {
  id: string;
  filename: string;
  preview_url: string;
  status: "pending" | "transcribing" | "done" | "error";
  result?: TranscriptionResult;
  error?: string;
}
