import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Delete, Sigma } from "lucide-react";
import { Chip, ChipRow } from "@/components/omni/ui";
import { evaluate } from "@/lib/calc/scientific";
import { useHistory } from "@/lib/history-store";
import { haptic } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Scientific Calculator — OmniCalc" },
      { name: "description", content: "Basic and scientific calculator with trigonometry, logarithms, powers and calculation history." },
      { property: "og:title", content: "Scientific Calculator — OmniCalc" },
      { property: "og:description", content: "Basic and scientific calculator with history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalculatorPage,
});

const FUNCS = new Set(["sin", "cos", "tan", "log", "ln", "sqrt"]);
const OPS = new Set(["÷", "×", "-", "+"]);
const FN_KEYS = new Set(["(", ")", "%", "sin", "cos", "tan", "π", "log", "ln", "√", "^"]);
const BASIC = [["AC", "(", ")", "÷"], ["7", "8", "9", "×"], ["4", "5", "6", "-"], ["1", "2", "3", "+"], ["%", "0", ".", "="]];
const SCI = [["sin", "cos", "tan", "π"], ["log", "ln", "√", "^"]];

function CalculatorPage() {
  const [expr, setExpr] = useState("");
  const [preview, setPreview] = useState("");
  const [sci, setSci] = useState(false);
  const [rad, setRad] = useState(false);
  const [hist, setHist] = useState<[string, string][]>([]);
  const add = useHistory((s) => s.add);

  const live = (e: string, r = rad) => {
    if (!e.trim()) return "";
    const v = evaluate(e, r);
    return v.ok ? `= ${v.formatted}` : "";
  };

  const press = (k: string) => {
    haptic();
    if (k === "AC") { setExpr(""); setPreview(""); return; }
    if (k === "=") {
      if (!expr.trim()) return;
      const v = evaluate(expr, rad);
      if (v.ok) {
        add({ category: "CALCULATOR", title: `${expr} = ${v.formatted}`, summary: `Expression: ${expr}`, detailsText: `Input: ${expr}\nResult: ${v.formatted}\nEvaluated using OmniCalc Engine` });
        setHist((h) => [[expr, v.formatted] as [string, string], ...h].slice(0, 21));
        setExpr(v.formatted);
        setPreview("");
      } else setPreview(`Error: ${v.message}`);
      return;
    }
    const token = k === "√" ? "sqrt" : k;
    const next = expr + (FUNCS.has(token) ? `${token}(` : token);
    setExpr(next);
    setPreview(live(next));
  };
  const back = () => {
    haptic();
    const next = expr.slice(0, -1);
    setExpr(next);
    setPreview(live(next));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const map: Record<string, string> = { "*": "×", "/": "÷", Enter: "=", "=": "=", Escape: "AC" };
      if (e.key === "Backspace") return back();
      const k = map[e.key] ?? e.key;
      if (/^[0-9.+\-%()^]$/.test(k) || ["×", "÷", "=", "AC"].includes(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keyClass = (k: string) =>
    cn(
      "h-14 rounded-2xl font-semibold transition active:scale-95 sm:h-16",
      k.length > 2 ? "text-base" : "text-2xl",
      k === "=" && "bg-primary text-primary-foreground font-bold",
      k === "AC" && "bg-destructive text-destructive-foreground font-bold",
      OPS.has(k) && "bg-tonal text-tonal-foreground font-bold",
      FN_KEYS.has(k) && "bg-surface-2 text-foreground",
      !(k === "=" || k === "AC" || OPS.has(k) || FN_KEYS.has(k)) && "border bg-card",
    );

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-3 pt-4">
      {hist.length > 0 && (
        <ChipRow>
          {hist.map(([e, r], i) => (
            <Chip key={`${e}-${i}`} onClick={() => { setExpr(e); setPreview(live(e)); }}>{e} = {r}</Chip>
          ))}
        </ChipRow>
      )}
      <div className="flex flex-1 flex-col justify-end rounded-3xl bg-card p-5 text-right shadow-soft">
        <div className="scrollbar-none overflow-x-auto whitespace-nowrap" dir="rtl">
          <span dir="ltr" className={cn("font-display font-light tabular-nums", expr.length > 12 ? "text-4xl" : "text-5xl")} data-testid="calculator_expression_display">{expr || "0"}</span>
        </div>
        <p className={cn("mt-2 min-h-8 text-2xl font-semibold", preview.startsWith("Error") ? "text-destructive text-base" : "text-primary")} data-testid="calculator_result_preview">{preview}</p>
      </div>
      <div className="flex items-center gap-2">
        <Chip selected={sci} onClick={() => setSci(!sci)} icon={<Sigma className="size-4" />}>Scientific</Chip>
        {sci && <Chip selected={rad} onClick={() => { setRad(!rad); setPreview(live(expr, !rad)); }}>{rad ? "RAD" : "DEG"}</Chip>}
        <button type="button" onClick={back} aria-label="Backspace" className="ml-auto grid size-11 place-items-center rounded-full hover:bg-surface-2"><Delete className="size-6" /></button>
      </div>
      <div className="grid gap-2">
        {sci && SCI.map((row, i) => (
          <div key={`s${i}`} className="grid grid-cols-4 gap-2">{row.map((k) => <button key={k} type="button" className={keyClass(k)} onClick={() => press(k)}>{k}</button>)}</div>
        ))}
        {BASIC.map((row, i) => (
          <div key={i} className="grid grid-cols-4 gap-2">{row.map((k) => <button key={k} type="button" className={keyClass(k)} onClick={() => press(k)} aria-label={k}>{k}</button>)}</div>
        ))}
      </div>
    </div>
  );
}
