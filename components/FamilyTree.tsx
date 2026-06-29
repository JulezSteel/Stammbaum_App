"use client";

// Ahnentafel (ancestor tree): selected person at the bottom, ancestors above,
// children listed below. SVG with pan (drag) and zoom (wheel).

import { useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import {
  exportSvg,
  exportPng,
  exportPdf,
  downloadBlob,
  slugify,
} from "@/lib/treeExport";

interface Props {
  persons: Person[]; // canonical persons
}

const NODE_W = 190;
const NODE_H = 84;
const H_GAP = 16;
const V_GAP = 56;

/** Wrap a name onto up to two lines by words; ellipsize only true overflow. */
function wrapName(name: string, maxChars = 24): string[] {
  if (name.length <= maxChars) return [name];
  const words = name.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) {
    const rest = lines.slice(1).join(" ");
    return [lines[0], rest.length > maxChars ? rest.slice(0, maxChars - 1) + "…" : rest];
  }
  return lines;
}

interface TreeNode {
  person: Person | null; // null = unknown ancestor slot
  depth: number;
  x: number; // center x
  father?: TreeNode;
  mother?: TreeNode;
}

function displayName(p: Person): string {
  return `${p.first_names.join(" ")} ${p.last_name}`.trim() || "(unbenannt)";
}

/** Build ancestor tree; returns root node and total width. */
function buildTree(
  root: Person,
  byId: Map<string, Person>,
  maxDepth: number
): { node: TreeNode; width: number } {
  let nextX = 0;

  function build(p: Person | null, depth: number): TreeNode {
    const node: TreeNode = { person: p, depth, x: 0 };
    const father = p?.parents.father_id ? byId.get(p.parents.father_id) ?? null : null;
    const mother = p?.parents.mother_id ? byId.get(p.parents.mother_id) ?? null : null;

    if (depth < maxDepth && (father || mother)) {
      node.father = build(father, depth + 1);
      node.mother = build(mother, depth + 1);
      node.x = (node.father.x + node.mother.x) / 2;
    } else {
      node.x = nextX;
      nextX += NODE_W + H_GAP;
    }
    return node;
  }

  const node = build(root, 0);
  return { node, width: Math.max(nextX - H_GAP, NODE_W) };
}

function flatten(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  out.push(node);
  if (node.father) flatten(node.father, out);
  if (node.mother) flatten(node.mother, out);
  return out;
}

export default function FamilyTree({ persons }: Props) {
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  // Default root: person with most ancestor generations beneath them
  const defaultRootId = useMemo(() => {
    let best: string | null = null;
    let bestDepth = -1;
    const depthOf = (id: string | null, seen: Set<string>): number => {
      if (!id || seen.has(id)) return 0;
      const p = byId.get(id);
      if (!p) return 0;
      seen.add(id);
      return 1 + Math.max(
        depthOf(p.parents.father_id, seen),
        depthOf(p.parents.mother_id, seen)
      );
    };
    for (const p of persons) {
      const d = depthOf(p.id, new Set());
      if (d > bestDepth) {
        bestDepth = d;
        best = p.id;
      }
    }
    return best;
  }, [persons, byId]);

  const [rootId, setRootId] = useState<string | null>(null);
  const effectiveRootId = rootId ?? defaultRootId;
  const root = effectiveRootId ? byId.get(effectiveRootId) : null;

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [exporting, setExporting] = useState<null | "svg" | "png" | "pdf">(null);

  const handleExport = async (kind: "svg" | "png" | "pdf") => {
    const svg = svgRef.current;
    if (!svg || !root || exporting) return;
    setExporting(kind);
    try {
      const title = `Stammbaum: ${displayName(root)}`;
      const base = `stammbaum_${slugify(displayName(root))}_${new Date()
        .toISOString()
        .slice(0, 10)}`;
      if (kind === "svg") {
        downloadBlob(await exportSvg(svg, title), `${base}.svg`);
      } else if (kind === "png") {
        downloadBlob(await exportPng(svg, title), `${base}.png`);
      } else {
        downloadBlob(await exportPdf(svg, title), `${base}.pdf`);
      }
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setExporting(null);
    }
  };

  const tree = useMemo(() => {
    if (!root) return null;
    return buildTree(root, byId, 12);
  }, [root, byId]);

  const children = useMemo(() => {
    if (!root) return [];
    return persons.filter(
      (p) => p.parents.father_id === root.id || p.parents.mother_id === root.id
    );
  }, [persons, root]);

  if (!persons.length) {
    return (
      <p className="text-center text-stone-400 py-16 text-sm">
        Noch keine Personen vorhanden – zuerst Dokumente transkribieren.
      </p>
    );
  }

  const nodes = tree ? flatten(tree.node) : [];
  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const svgHeight = (maxDepth + 1) * (NODE_H + V_GAP) + 40;
  const yOf = (depth: number) => svgHeight - 20 - NODE_H - depth * (NODE_H + V_GAP);

  const sorted = [...persons].sort((a, b) =>
    displayName(a).localeCompare(displayName(b), "de")
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-stone-600 font-medium">Stammperson:</label>
        <select
          value={effectiveRootId ?? ""}
          onChange={(e) => { setRootId(e.target.value); setView({ x: 0, y: 0, scale: 1 }); }}
          className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-400"
        >
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {displayName(p)} {p.birth_date ? `(* ${p.birth_date})` : ""}
            </option>
          ))}
        </select>
        <span className="text-xs text-stone-400">
          Ziehen zum Verschieben · Mausrad zum Zoomen
        </span>

        {tree && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-stone-400">Herunterladen:</span>
            {(["png", "pdf", "svg"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => handleExport(kind)}
                disabled={exporting !== null}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 bg-white hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50 disabled:cursor-wait transition-colors"
              >
                {exporting === kind ? "…" : `↓ ${kind.toUpperCase()}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {tree && (
        <div
          className="border border-stone-200 rounded-xl bg-white overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ height: "60vh", minHeight: 400 }}
          onWheel={(e) => {
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            setView((v) => ({ ...v, scale: Math.min(3, Math.max(0.2, v.scale * factor)) }));
          }}
          onMouseDown={(e) => {
            dragRef.current = { startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y };
          }}
          onMouseMove={(e) => {
            if (!dragRef.current) return;
            const d = dragRef.current;
            setView((v) => ({
              ...v,
              x: d.vx + (e.clientX - d.startX),
              y: d.vy + (e.clientY - d.startY),
            }));
          }}
          onMouseUp={() => (dragRef.current = null)}
          onMouseLeave={() => (dragRef.current = null)}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            data-content-width={tree.width}
            data-content-height={svgHeight}
          >
            <defs>
              <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#78716c" floodOpacity="0.18" />
              </filter>
            </defs>
            <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
              {/* connectors */}
              {nodes.map((n, i) => {
                if (!n.father && !n.mother) return null;
                const x = n.x + NODE_W / 2;
                const y = yOf(n.depth);
                const py = yOf(n.depth + 1) + NODE_H;
                return (
                  <g key={`c${i}`} stroke="#d6d3d1" strokeWidth={1.5} fill="none">
                    {n.father && (
                      <path d={`M ${x} ${y} V ${(y + py) / 2} H ${n.father.x + NODE_W / 2} V ${py}`} />
                    )}
                    {n.mother && (
                      <path d={`M ${x} ${y} V ${(y + py) / 2} H ${n.mother.x + NODE_W / 2} V ${py}`} />
                    )}
                  </g>
                );
              })}
              {/* nodes */}
              {nodes.map((n, i) => {
                const y = yOf(n.depth);
                const p = n.person;
                const nameLines = p ? wrapName(displayName(p)) : [];
                // Single-line names sit lower so content stays vertically centered
                const nameY = nameLines.length > 1 ? 22 : 30;
                const datesY = nameLines.length > 1 ? 54 : 48;
                const placeY = nameLines.length > 1 ? 70 : 64;
                return (
                  <g key={`n${i}`} transform={`translate(${n.x},${y})`}>
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={12}
                      fill={p ? (n.depth === 0 ? "#fef3c7" : "#ffffff") : "#f5f5f4"}
                      stroke={p ? (n.depth === 0 ? "#d97706" : "#d6d3d1") : "#e7e5e4"}
                      strokeWidth={1.5}
                      strokeDasharray={p ? undefined : "4 3"}
                      filter={p ? "url(#nodeShadow)" : undefined}
                      className={p ? "cursor-pointer" : undefined}
                      onClick={() => p && setRootId(p.id)}
                    />
                    {p ? (
                      <>
                        {nameLines.map((line, li) => (
                          <text
                            key={li}
                            x={NODE_W / 2}
                            y={nameY + li * 15}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={600}
                            fill="#44403c"
                            style={{ pointerEvents: "none" }}
                          >
                            {line}
                          </text>
                        ))}
                        <text x={NODE_W / 2} y={datesY} textAnchor="middle" fontSize={10} fill="#78716c" style={{ pointerEvents: "none" }}>
                          {[p.birth_date && `* ${p.birth_date}`, p.death_date && `† ${p.death_date}`]
                            .filter(Boolean).join("   ")}
                        </text>
                        <text x={NODE_W / 2} y={placeY} textAnchor="middle" fontSize={9} fill="#a8a29e" style={{ pointerEvents: "none" }}>
                          {(p.birth_place ?? p.occupation ?? "").slice(0, 30)}
                        </text>
                      </>
                    ) : (
                      <text x={NODE_W / 2} y={NODE_H / 2 + 4} textAnchor="middle" fontSize={11} fill="#a8a29e" fontStyle="italic">
                        unbekannt
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      {/* Children of root */}
      {children.length > 0 && root && (
        <div className="border border-stone-200 rounded-xl p-4 bg-white">
          <h3 className="font-semibold text-stone-700 text-sm mb-2">
            Kinder von {displayName(root)} ({children.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setRootId(c.id)}
                className="px-3 py-1.5 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-lg text-xs text-stone-700"
              >
                {displayName(c)} {c.birth_date ? `(* ${c.birth_date})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
