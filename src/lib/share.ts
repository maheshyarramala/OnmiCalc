import { toast } from "sonner";

/** Web replacement for Android share intents: native share sheet, else copy to clipboard. */
export async function shareText(text: string, title = "OmniCalc") {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
  }
  await copyText(text, "Copied to clipboard");
}

export async function copyText(text: string, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Could not access the clipboard");
  }
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens a printable HTML report in a new window (replaces Android PdfDocument). */
export function printReport(title: string, bodyHtml: string) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to export the PDF report");
    return;
  }
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A;margin:32px}
    h1{color:#4F46E5;margin:0 0 4px} h2{margin:24px 0 8px;font-size:16px}
    .muted{color:#64748B;font-size:12px} table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{padding:6px 8px;border-bottom:1px solid #E2E8F0;text-align:right} th:first-child,td:first-child{text-align:left}
    th{background:#EEF2FF;color:#312E81} .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .box{border:1px solid #E2E8F0;border-radius:10px;padding:10px} .box b{display:block;font-size:16px;margin-top:2px}
    @media print{button{display:none}}
  </style></head><body>${bodyHtml}<p class="muted" style="margin-top:24px">Generated via OmniCalc</p>
  <button onclick="window.print()" style="margin-top:12px;padding:8px 16px;border-radius:8px;border:0;background:#4F46E5;color:#fff">Save as PDF / Print</button>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
