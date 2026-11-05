import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Calculator, History, Landmark, PiggyBank, Share2, Star, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow, EmptyState, Modal } from "@/components/omni/ui";
import { useHistory, shareText as recordShareText } from "@/lib/history-store";
import { useUi } from "@/lib/ui-store";
import { formatTimestamp } from "@/lib/format";
import { shareText } from "@/lib/share";
import type { CalculationRecord } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  ["ALL", "All"], ["EMI", "Loans & EMI"], ["SIP", "SIP"], ["LUMPSUM", "Lump Sum"], ["CALCULATOR", "Calculator"],
  ["AGE", "Age"], ["CALENDAR", "Calendar"], ["CURRENCY", "Currency"], ["UNIT", "Units"], ["TIP", "Tip & Split"], ["GST", "GST"], ["INTEREST", "Interest"],
] as const;

function RecordCard({ r, showStar = true }: { r: CalculationRecord; showStar?: boolean }) {
  const toggle = useHistory((s) => s.toggleFavorite);
  const remove = useHistory((s) => s.remove);
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">{r.category}</span>
        <span>{formatTimestamp(r.timestamp)}</span>
      </div>
      <p className="mt-2 font-semibold">{r.title}</p>
      <p className="text-sm text-muted-foreground">{r.summary}</p>
      <div className="mt-2 flex justify-end gap-1">
        {showStar && (
          <Button variant="ghost" size="icon" aria-label={r.isFavorite ? "Remove from Favorites" : "Add to Favorites"} onClick={() => toggle(r.id)}>
            <Star className={cn("size-4", r.isFavorite && "fill-warning text-warning")} />
          </Button>
        )}
        {!showStar && (
          <Button variant="ghost" size="sm" onClick={() => toggle(r.id)}>Remove from Favorites</Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Share" onClick={() => shareText(recordShareText(r), r.title)}>
          <Share2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(r.id)}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function HistorySheet() {
  const open = useUi((s) => s.sheet === "history");
  const openSheet = useUi((s) => s.openSheet);
  const records = useHistory((s) => s.records);
  const clearAll = useHistory((s) => s.clearAll);
  const [filter, setFilter] = useState<string>("ALL");
  const [confirm, setConfirm] = useState(false);
  const list = filter === "ALL" ? records : records.filter((r) => r.category === filter);
  return (
    <>
      <Modal open={open} onOpenChange={(o) => openSheet(o ? "history" : null)} title="Saved History" description={`${records.length} saved calculations`}>
        <ChipRow>
          {FILTERS.map(([k, l]) => (
            <Chip key={k} selected={filter === k} onClick={() => setFilter(k)}>{l}</Chip>
          ))}
        </ChipRow>
        {list.length === 0 ? (
          <EmptyState icon={History} title="No saved calculations yet" text="Tap the save icon in any calculator to keep results here." />
        ) : (
          <div className="space-y-2">
            {list.map((r) => <RecordCard key={r.id} r={r} />)}
          </div>
        )}
        {records.length > 0 && (
          <Button variant="outline" className="text-destructive" onClick={() => setConfirm(true)}>
            <Trash2 /> Clear All
          </Button>
        )}
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Clear All History?"
        description="This will permanently remove all your saved calculations."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { clearAll(); setConfirm(false); }}>Clear All</Button>
          </>
        }
      />
    </>
  );
}

const TOOLS = [
  { label: "Loan EMI", icon: Landmark, to: "/emi" },
  { label: "SIP & Growth", icon: TrendingUp, to: "/invest" },
  { label: "Expenses", icon: PiggyBank, to: "/" },
  { label: "Scientific", icon: Calculator, to: "/calculator" },
] as const;

export function FavoritesSheet() {
  const open = useUi((s) => s.sheet === "favorites");
  const openSheet = useUi((s) => s.openSheet);
  const records = useHistory((s) => s.records);
  const favs = records.filter((r) => r.isFavorite);
  const navigate = useNavigate();
  return (
    <Modal open={open} onOpenChange={(o) => openSheet(o ? "favorites" : null)} title="Favorites & Starred" description={`${favs.length} starred`}>
      <p className="text-sm font-semibold">Quick Launch Tools</p>
      <div className="grid grid-cols-4 gap-2">
        {TOOLS.map((t) => (
          <button key={t.label} type="button" onClick={() => { openSheet(null); void navigate({ to: t.to }); }} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2 p-3 text-xs font-semibold">
            <t.icon className="size-5 text-primary" />
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold">Starred Calculations</p>
      {favs.length === 0 ? (
        <EmptyState icon={Star} title="No starred calculations yet" text="Tap the star icon in History or bookmark in calculators to pin here!" />
      ) : (
        <div className="space-y-2">{favs.map((r) => <RecordCard key={r.id} r={r} showStar={false} />)}</div>
      )}
    </Modal>
  );
}
