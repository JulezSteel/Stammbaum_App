// GEDCOM 5.5.1 export — opens the data in Ahnenblatt, Gramps, MyHeritage, Ancestry, etc.

import type { Person } from "./types";

function gedcomDate(date: string | null): string | null {
  if (!date) return null;
  const m = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${parseInt(m[1])} ${months[parseInt(m[2]) - 1]} ${m[3]}`;
  }
  const y = date.match(/(\d{4})/);
  return y ? `ABT ${y[1]}` : null;
}

export function toGedcom(persons: Person[]): string {
  const lines: string[] = [
    "0 HEAD",
    "1 SOUR Familienbaum",
    "1 GEDC",
    "2 VERS 5.5.1",
    "2 FORM LINEAGE-LINKED",
    "1 CHAR UTF-8",
  ];

  const idx = new Map(persons.map((p, i) => [p.id, i + 1]));
  const xref = (id: string) => `@I${idx.get(id)}@`;

  // Families: one per unique parent-couple or partner-couple
  interface Fam { husb?: string; wife?: string; children: string[]; marriage?: string | null }
  const fams = new Map<string, Fam>();
  const famKey = (a: string | null, b: string | null) => `${a ?? "?"}|${b ?? "?"}`;

  for (const p of persons) {
    const { father_id, mother_id } = p.parents;
    if (father_id || mother_id) {
      const key = famKey(father_id, mother_id);
      const fam = fams.get(key) ?? {
        husb: father_id && idx.has(father_id) ? father_id : undefined,
        wife: mother_id && idx.has(mother_id) ? mother_id : undefined,
        children: [],
      };
      fam.children.push(p.id);
      fams.set(key, fam);
    }
    for (const pt of p.partners) {
      if (!idx.has(pt.person_id)) continue;
      const [a, b] = [p.id, pt.person_id].sort();
      const key = famKey(a, b);
      if (!fams.has(key)) {
        fams.set(key, { husb: a, wife: b, children: [], marriage: pt.marriage_date });
      } else if (pt.marriage_date) {
        fams.get(key)!.marriage = fams.get(key)!.marriage ?? pt.marriage_date;
      }
    }
  }

  const famIds = new Map([...fams.keys()].map((k, i) => [k, `@F${i + 1}@`]));

  // Per-person family roles
  const famcOf = new Map<string, string>(); // child -> fam xref
  const famsOf = new Map<string, string[]>(); // spouse -> fam xrefs
  for (const [key, fam] of fams) {
    const fx = famIds.get(key)!;
    for (const c of fam.children) famcOf.set(c, fx);
    for (const s of [fam.husb, fam.wife]) {
      if (s) famsOf.set(s, [...(famsOf.get(s) ?? []), fx]);
    }
  }

  for (const p of persons) {
    lines.push(`0 ${xref(p.id)} INDI`);
    lines.push(`1 NAME ${p.first_names.join(" ")} /${p.last_name}/`);
    if (p.birth_date || p.birth_place) {
      lines.push("1 BIRT");
      const d = gedcomDate(p.birth_date);
      if (d) lines.push(`2 DATE ${d}`);
      if (p.birth_place) lines.push(`2 PLAC ${p.birth_place}`);
    }
    if (p.death_date || p.death_place) {
      lines.push("1 DEAT");
      const d = gedcomDate(p.death_date);
      if (d) lines.push(`2 DATE ${d}`);
      if (p.death_place) lines.push(`2 PLAC ${p.death_place}`);
    }
    if (p.occupation) lines.push(`1 OCCU ${p.occupation}`);
    if (p.religion) lines.push(`1 RELI ${p.religion}`);
    const famc = famcOf.get(p.id);
    if (famc) lines.push(`1 FAMC ${famc}`);
    for (const fx of famsOf.get(p.id) ?? []) lines.push(`1 FAMS ${fx}`);
    for (const src of p.sources) lines.push(`1 NOTE Quelle: ${src}`);
  }

  for (const [key, fam] of fams) {
    lines.push(`0 ${famIds.get(key)} FAM`);
    if (fam.husb && idx.has(fam.husb)) lines.push(`1 HUSB ${xref(fam.husb)}`);
    if (fam.wife && idx.has(fam.wife)) lines.push(`1 WIFE ${xref(fam.wife)}`);
    if (fam.marriage) {
      const d = gedcomDate(fam.marriage);
      if (d) {
        lines.push("1 MARR");
        lines.push(`2 DATE ${d}`);
      }
    }
    for (const c of fam.children) lines.push(`1 CHIL ${xref(c)}`);
  }

  lines.push("0 TRLR");
  return lines.join("\r\n");
}
