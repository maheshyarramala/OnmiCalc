// Ported from domain/calculator/ScientificEvaluator.kt (recursive-descent parser)

export type EvalResult = { ok: true; value: number; formatted: string } | { ok: false; message: string };

export function formatResult(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
  const rounded = Math.trunc(value);
  if (Math.abs(value - rounded) < 1e-11) return String(rounded);
  let str = value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  if (str.length > 15) {
    const [m, e] = value.toExponential(6).split("e");
    const exp = parseInt(e ?? "0", 10);
    str = `${m}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return str;
}

export function evaluate(expression: string, isRadians: boolean): EvalResult {
  if (!expression.trim()) return { ok: true, value: 0, formatted: "0" };
  try {
    const input = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/√/g, "sqrt");
    const v = new Parser(input, isRadians).parse();
    if (!isFinite(v)) return { ok: false, message: "Undefined result" };
    return { ok: true, value: v, formatted: formatResult(v) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid expression" };
  }
}

const isAlpha = (c: string) => /[a-zA-Z]/.test(c);
const isDigit = (c: string) => /[0-9.]/.test(c);

class Parser {
  private pos = -1;
  private ch = "";
  constructor(private input: string, private isRadians: boolean) {}
  private next() {
    this.pos++;
    this.ch = this.pos < this.input.length ? (this.input[this.pos] ?? "") : "";
  }
  private skip() {
    while (this.ch === " ") this.next();
  }
  private eat(c: string) {
    this.skip();
    if (this.ch === c) {
      this.next();
      return true;
    }
    return false;
  }
  private implicitNext() {
    this.skip();
    return this.ch === "(" || this.ch === "π" || (this.ch !== "" && isAlpha(this.ch));
  }
  parse() {
    this.next();
    const x = this.expr();
    if (this.pos < this.input.length) throw new Error("Unexpected: " + this.input[this.pos]);
    return x;
  }
  private expr(): number {
    let x = this.term();
    for (;;) {
      if (this.eat("+")) x += this.term();
      else if (this.eat("-")) x -= this.term();
      else return x;
    }
  }
  private term(): number {
    let x = this.factor();
    for (;;) {
      if (this.eat("*")) x *= this.factor();
      else if (this.eat("/")) {
        const d = this.factor();
        if (Math.abs(d) < 1e-15) throw new Error("Division by zero");
        x /= d;
      } else if (this.eat("%")) x %= this.factor();
      else if (this.implicitNext()) x *= this.factor();
      else return x;
    }
  }
  private factor(): number {
    if (this.eat("+")) return this.factor();
    if (this.eat("-")) return -this.factor();
    let x: number;
    this.skip();
    const start = this.pos;
    if (this.eat("(")) {
      x = this.expr();
      if (!this.eat(")")) throw new Error("Missing closing parenthesis");
    } else if (this.eat("π")) {
      x = Math.PI;
    } else if (this.ch !== "" && isDigit(this.ch)) {
      while (this.ch !== "" && isDigit(this.ch)) this.next();
      const s = this.input.substring(start, this.pos);
      if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) throw new Error("Invalid number: " + s);
      x = parseFloat(s);
    } else if (this.ch !== "" && isAlpha(this.ch)) {
      while (this.ch !== "" && isAlpha(this.ch)) this.next();
      const id = this.input.substring(start, this.pos).toLowerCase();
      if (id === "pi") x = Math.PI;
      else if (id === "e") x = Math.E;
      else if (this.eat("(")) {
        const arg = this.expr();
        if (!this.eat(")")) throw new Error(`Missing ')' after ${id}`);
        x = this.fn(id, arg);
      } else throw new Error(`Expected '(' after ${id}`);
    } else {
      throw new Error("Unexpected character: " + (this.ch !== "" ? this.ch : "end of input"));
    }
    if (this.eat("^")) x = Math.pow(x, this.factor());
    return x;
  }
  private fn(f: string, a: number) {
    const rad = (v: number) => (this.isRadians ? v : (v * Math.PI) / 180);
    switch (f) {
      case "sqrt":
        if (a < 0) throw new Error("Square root of negative number");
        return Math.sqrt(a);
      case "sin":
        return Math.sin(rad(a));
      case "cos":
        return Math.cos(rad(a));
      case "tan":
        return Math.tan(rad(a));
      case "log":
        if (a <= 0) throw new Error("Log of non-positive number");
        return Math.log10(a);
      case "ln":
        if (a <= 0) throw new Error("Ln of non-positive number");
        return Math.log(a);
      case "abs":
        return Math.abs(a);
      default:
        throw new Error("Unknown function: " + f);
    }
  }
}
