// Export the rendered family-tree SVG to a standalone SVG, a PNG raster, or a
// real PDF — all generated locally in the browser, no dependencies, no upload.

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAD = 28; // outer margin around the tree
const HEADER = 48; // space for the title line

/**
 * Wrap the live tree <svg> into a self-contained, full-size SVG string.
 * The on-screen svg is pan/zoomed (width/height 100% + a view transform); for
 * export we drop that and lay the whole tree out at natural size on white.
 */
export function buildExportSvg(
  src: SVGSVGElement,
  title: string
): { svg: string; width: number; height: number } {
  const g = src.querySelector("g");
  const inner = g ? g.innerHTML : src.innerHTML;

  const contentW = Number(src.dataset.contentWidth) || 800;
  const contentH = Number(src.dataset.contentHeight) || 600;

  const width = contentW + PAD * 2;
  const height = contentH + PAD * 2 + HEADER;

  const titleMarkup = title
    ? `<text x="${PAD}" y="30" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#44403c">${escapeXml(
        title
      )}</text>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>` +
    titleMarkup +
    `<g transform="translate(${PAD},${PAD + HEADER})">${inner}</g>` +
    `</svg>`;

  return { svg, width, height };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render an SVG string onto a canvas at `scale`× for crisp output. */
function rasterize(
  svg: string,
  width: number,
  height: number,
  scale: number
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      // White backing so PNG transparency / JPEG black is avoided.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to rasterize SVG"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
      type,
      quality
    );
  });
}

export async function exportSvg(src: SVGSVGElement, title: string): Promise<Blob> {
  const { svg } = buildExportSvg(src, title);
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

export async function exportPng(src: SVGSVGElement, title: string): Promise<Blob> {
  const { svg, width, height } = buildExportSvg(src, title);
  const canvas = await rasterize(svg, width, height, 2);
  return canvasToBlob(canvas, "image/png");
}

/**
 * Build a minimal but valid PDF that embeds the tree as a JPEG image
 * (DCTDecode). Assembling the PDF by hand avoids any external library.
 */
export async function exportPdf(src: SVGSVGElement, title: string): Promise<Blob> {
  const { svg, width, height } = buildExportSvg(src, title);
  const canvas = await rasterize(svg, width, height, 2);
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let pos = 0;
  const offsets: number[] = [];
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    pos += bytes.length;
  };

  const pageW = Math.round(width);
  const pageH = Math.round(height);
  const imgW = canvas.width;
  const imgH = canvas.height;

  push("%PDF-1.3\n");

  offsets[1] = pos;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets[2] = pos;
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  offsets[3] = pos;
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets[4] = pos;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  // Place the image to fill the whole page (PDF origin is bottom-left).
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  offsets[5] = pos;
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefPos = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

/** Filesystem-safe slug for filenames. */
export function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40) || "stammbaum"
  );
}
