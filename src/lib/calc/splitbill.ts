// Port of domain/splitbill (SplitBillModel, DebtSimplifier, ReceiptOcrParser, PaymentDeepLinkHelper).

export interface Participant {
  id: string;
  name: string;
  avatarColorHex: string;
  upiId: string;
  paypalUsername: string;
  paidAmount: number;
}
export interface ReceiptItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  claimedParticipantIds: string[];
  paidByParticipantId: string | null;
}
export interface PersonBreakdown {
  participant: Participant;
  subtotal: number;
  taxShare: number;
  tipShare: number;
  discountShare: number;
  totalToPay: number;
  paidAmount: number;
  netBalance: number;
}
export interface DebtTransfer {
  fromParticipant: Participant;
  toParticipant: Participant;
  amount: number;
}
export interface ParsedReceipt {
  title: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  grandTotal: number;
}

let seq = 0;
export const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const AVATAR_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4", "#EF4444"];

const nonNeg = (n: number) => (isFinite(n) ? Math.max(0, n) : 0);
const toCents = (n: number) => Math.round(nonNeg(n) * 100 + 1e-9);
export const round2 = (v: number) => (isFinite(v) ? Math.round(v * 100 + (v >= 0 ? 1e-9 : -1e-9)) / 100 : 0);

function distributeCents(amount: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const safe = weights.map(nonNeg);
  const actual = safe.reduce((a, b) => a + b, 0) > 0 ? safe : weights.map(() => 1);
  const total = actual.reduce((a, b) => a + b, 0);
  const exact = actual.map((w) => (amount * w) / total);
  const cents = exact.map(Math.floor);
  let rem = amount - cents.reduce((a, b) => a + b, 0);
  const at = (arr: number[], k: number) => arr[k] ?? 0;
  const prio = exact.map((_, i) => i).sort((a, b) => at(exact, b) - at(cents, b) - (at(exact, a) - at(cents, a)) || a - b);
  let i = 0;
  while (rem > 0) {
    const k = prio[i++ % prio.length] ?? 0;
    cents[k] = (cents[k] ?? 0) + 1;
    rem--;
  }
  return cents;
}
const distribute = (amount: number, weights: number[]) => distributeCents(toCents(amount), weights).map((n) => n / 100);

export function calculateBreakdowns(
  participants: Participant[],
  items: ReceiptItem[],
  tax: number,
  tip: number,
  discount: number,
): PersonBreakdown[] {
  if (!participants.length) return [];
  tax = nonNeg(tax);
  tip = nonNeg(tip);
  discount = nonNeg(discount);
  const cents = new Map(participants.map((p) => [p.id, 0]));
  const allIds = participants.map((p) => p.id);
  for (const item of items) {
    let c = item.claimedParticipantIds.length ? item.claimedParticipantIds.filter((id) => cents.has(id)) : allIds;
    if (!c.length) c = allIds;
    const amount = toCents(nonNeg(item.price) * Math.max(1, item.quantity));
    const shares = distributeCents(amount, c.map(() => 1));
    c.forEach((id, i) => cents.set(id, (cents.get(id) ?? 0) + (shares[i] ?? 0)));
  }
  const subtotals = participants.map((p) => (cents.get(p.id) ?? 0) / 100);
  const weights = subtotals.map((n) => Math.max(0, n));
  const payments = new Map(
    participants.map((p) => [
      p.id,
      nonNeg(p.paidAmount) +
        items
          .filter((it) => it.paidByParticipantId === p.id)
          .reduce((s, it) => s + toCents(nonNeg(it.price) * Math.max(1, it.quantity)) / 100, 0),
    ]),
  );
  const base = subtotals.reduce((a, b) => a + b, 0);
  const safeDisc = Math.min(discount, base + tax + tip);
  const taxes = distribute(tax, weights);
  const tips = distribute(tip, weights);
  const discs = distribute(safeDisc, weights);
  const totals = distribute(Math.max(0, base + tax + tip - safeDisc), weights);
  return participants.map((p, i) => {
    const paid = payments.get(p.id) ?? 0;
    return {
      participant: p,
      subtotal: subtotals[i] ?? 0,
      taxShare: taxes[i] ?? 0,
      tipShare: tips[i] ?? 0,
      discountShare: discs[i] ?? 0,
      totalToPay: totals[i] ?? 0,
      paidAmount: round2(paid),
      netBalance: round2(paid - (totals[i] ?? 0)),
    };
  });
}

export function settleTransfers(breakdowns: PersonBreakdown[], optimize: boolean): DebtTransfer[] {
  if (breakdowns.length < 2) return [];
  const creditors: { p: Participant; b: number }[] = [];
  const debtors: { p: Participant; b: number }[] = [];
  for (const b of breakdowns) {
    const net = round2(b.paidAmount - b.totalToPay);
    if (net > 0.005) creditors.push({ p: b.participant, b: net });
    else if (net < -0.005) debtors.push({ p: b.participant, b: Math.abs(net) });
  }
  if (optimize) {
    creditors.sort((a, b) => b.b - a.b);
    debtors.sort((a, b) => b.b - a.b);
  }
  const out: DebtTransfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const cr = creditors[c];
    const de = debtors[d];
    if (!cr || !de) break;
    const amt = round2(Math.min(cr.b, de.b));
    if (amt > 0.005) out.push({ fromParticipant: de.p, toParticipant: cr.p, amount: amt });
    cr.b = round2(cr.b - amt);
    de.b = round2(de.b - amt);
    if (cr.b <= 0.005) c++;
    if (de.b <= 0.005) d++;
  }
  return out;
}

const priceRe = () => /(?:[$₹€£]|Rs\.?|INR)?\s*([0-9]+(?:[.,][0-9]{2})?)/g;
function lastNumber(text: string): number | null {
  let r: number | null = null;
  for (const m of text.matchAll(priceRe())) {
    const n = Number((m[1] ?? "").replace(",", "."));
    if (!Number.isNaN(n)) r = n;
  }
  return r;
}

export function parseReceiptText(text: string, defaultTitle = "Dining Receipt"): ParsedReceipt {
  const lines = text.split(/\r\n|\n|\r/).map((s) => s.trim()).filter(Boolean);
  const items: ReceiptItem[] = [];
  let subtotal = 0, tax = 0, tip = 0, discount = 0, total = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (["tax", "gst", "vat", "sales tax"].some((s) => lower.includes(s))) { tax = lastNumber(line) ?? tax; continue; }
    if (["tip", "gratuity", "service charge"].some((s) => lower.includes(s))) { tip = lastNumber(line) ?? tip; continue; }
    if (["discount", "coupon", "promo"].some((s) => lower.includes(s)) || /\boff\b/.test(lower)) { discount = lastNumber(line) ?? discount; continue; }
    if (["total", "grand total", "amount due", "final amount"].some((s) => lower.startsWith(s))) { total = lastNumber(line) ?? total; continue; }
    if (["subtotal", "sub total", "net total"].some((s) => lower.startsWith(s))) { subtotal = lastNumber(line) ?? subtotal; continue; }
    if (["date:", "table:", "server:", "cashier:", "thank you", "order #", "----"].some((s) => lower.includes(s))) continue;
    let price: number | null = null;
    let start = -1;
    for (const m of line.matchAll(priceRe())) {
      const n = Number((m[1] ?? "").replace(",", "."));
      if (n > 0 && n < 1_000_000) { price = n; start = m.index!; }
    }
    if (price !== null && start > 0) {
      const rawName = line.slice(0, start).trim().replace(/^[-:.]+|[-:.]+$/g, "");
      if (rawName.trim() && rawName.length > 1) {
        items.push({ id: uid(), title: rawName.replace(/^\d+\s*x?\s*/i, "").trim() || "Item", price, quantity: 1, claimedParticipantIds: [], paidByParticipantId: null });
      }
    }
  }
  const computed = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const finalSub = subtotal > 0 ? subtotal : computed;
  return { title: defaultTitle, items, subtotal: finalSub, tax, tip, discount, grandTotal: total > 0 ? total : finalSub + tax + tip - discount };
}

export const DEMO_RECEIPTS = {
  bistro: `Trattoria Bella Vista
Table: 04  Guests: 4
----------------------------------------
1x Bruschetta Pomodoro       280.00
1x Crispy Calamari           450.00
2x Truffle Pasta            1100.00
1x Margherita Pizza          550.00
2x Pinot Noir Red Wine       800.00
2x Sparkling Water           160.00
1x Tiramisu Tradizionale     320.00
----------------------------------------
Subtotal:                   3660.00
CGST & SGST (5%):            183.00
Service Charge (10%):        366.00
Discount Coupon:             200.00
Grand Total:                4009.00`,
  cafe: `Artisan Roasters Cafe
Order #1029
----------------------------------------
2x Flat White Coffee         440.00
1x Almond Croissant          180.00
1x Avocado Sourdough Toast   390.00
1x Blueberry Acai Bowl       360.00
1x Belgian Waffle            320.00
----------------------------------------
Subtotal:                   1690.00
GST (5%):                     84.50
Tip (Gracious):              100.00
Total Due:                  1874.50`,
  sushi: `Sakura Japanese Kitchen
----------------------------------------
1x Edamame Sea Salt          190.00
1x Salmon Nigiri Platter     850.00
1x Dragon Roll (8 pcs)       680.00
1x Chicken Katsu Curry       480.00
2x Asahi Japanese Beer       600.00
1x Green Tea Mochi           220.00
----------------------------------------
Subtotal:                   3020.00
Tax:                         151.00
Service Charge:              250.00
Final Amount:               3421.00`,
};

const m2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const upiLink = (upiId: string, payee: string, amount: number, currency = "INR", note = "OmniCalc Split Bill") =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${amount.toFixed(2)}&cu=${currency}&tn=${encodeURIComponent(note)}`;
export const paypalLink = (user: string, amount: number) => `https://www.paypal.me/${user.replace(/^@/, "").trim()}/${amount.toFixed(2)}`;

export function breakdownShareText(title: string, sym: string, grandTotal: number, bds: PersonBreakdown[], transfers: DebtTransfer[]) {
  let t = `🍽️ *OmniCalc Bill Split: ${title}*\n💰 *Total Bill:* ${sym}${m2(grandTotal)}\n\n👥 *Individual Share Breakdown:*\n`;
  for (const b of bds) {
    t += `• *${b.participant.name}*: ${sym}${m2(b.totalToPay)}`;
    if (b.paidAmount > 0) t += ` (Paid: ${sym}${m2(b.paidAmount)})`;
    if (b.netBalance > 0.005) t += ` 🟢 *Gets back ${sym}${m2(b.netBalance)}*`;
    else if (b.netBalance < -0.005) t += ` 🔴 *Owes ${sym}${m2(Math.abs(b.netBalance))}*`;
    t += "\n";
  }
  if (transfers.length) {
    t += "\n⚡ *Settlement Transfers (Who Owes Whom):*\n";
    for (const x of transfers) {
      t += `👉 *${x.fromParticipant.name}* ➔ pays *${x.toParticipant.name}* : ${sym}${m2(x.amount)}`;
      if (x.toParticipant.upiId.trim()) t += ` (UPI: \`${x.toParticipant.upiId}\`)`;
      t += "\n";
    }
  }
  return t + "\n✨ Split and settled via OmniCalc";
}

export function nudgeText(debtor: string, amount: number, sym: string, title: string, creditorUpi: string) {
  let t = `Hey ${debtor}! Just a friendly reminder for ${title}: your share is ${sym}${m2(amount)}.`;
  if (creditorUpi.trim()) t += ` You can pay directly to UPI: ${creditorUpi}`;
  return t;
}
