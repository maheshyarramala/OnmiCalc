import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, Copy, Download, Share2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Modal, TextField } from "@/components/omni/ui";
import { getFinanceData, useFinance } from "@/lib/finance/store";
import { backupFileName, exportToJson, parseFromJson } from "@/lib/finance/backup";
import { copyText, downloadText, shareText } from "@/lib/share";

export function BackupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useFinance();
  const [replace, setReplace] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const restore = (json: string) => {
    const r = parseFromJson(json);
    if (!r.ok) { toast.error(r.message); return; }
    try {
      s.restoreBackup(r.payload, replace);
      toast.success(`Universal backup restored: ${r.summary}!`);
      setPaste(null);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Backup restore failed: ${e instanceof Error ? e.message : "Unable to write data"}`);
    }
  };

  const counts: [string, number][] = [
    ["Categories", s.categories.length], ["Bank Accounts", s.bankAccounts.length], ["Trips", s.trips.length], ["Expenses", s.expenses.length],
    ["Loans", s.loans.length], ["Debts", s.debts.length], ["Subscriptions", s.subscriptions.length], ["Card Bills", s.creditCardReminders.length],
  ];

  return (
    <>
      <Modal open={open && paste === null} onOpenChange={onOpenChange} title="Data Backup & Restore" description="Export and import your data via JSON — works with backups from the OmniCalc Android app.">
        <div className="grid grid-cols-4 gap-2">
          {counts.map(([l, n]) => (
            <div key={l} className="rounded-2xl bg-surface-2 p-2 text-center"><p className="font-display text-lg font-bold">{n}</p><p className="text-[10px] leading-tight text-muted-foreground">{l}</p></div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-semibold">Export Data (Backup)</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="tonal" onClick={() => { downloadText(backupFileName(), exportToJson(getFinanceData())); toast.success("Backup file saved"); }}><Download /> File</Button>
            <Button variant="outline" onClick={() => shareText(exportToJson(getFinanceData()), "OmniCalc Universal Finance Backup")}><Share2 /> Share</Button>
            <Button variant="outline" onClick={() => copyText(exportToJson(getFinanceData()), "Backup JSON copied to clipboard!")}><Copy /> Copy</Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="font-semibold">Import Data (Restore)</p>
          <div className="flex gap-2">
            <Chip selected={!replace} onClick={() => setReplace(false)}>Merge with existing</Chip>
            <Chip selected={replace} onClick={() => setReplace(true)}>Replace everything</Chip>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => fileRef.current?.click()}><Upload /> Import File</Button>
            <Button variant="outline" onClick={() => setPaste("")}><ClipboardPaste /> Paste JSON</Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) restore(await f.text());
            }}
          />
        </div>
      </Modal>
      <Modal
        open={open && paste !== null}
        onOpenChange={(o) => !o && setPaste(null)}
        title="Paste Backup JSON"
        footer={<><Button variant="ghost" onClick={() => setPaste(null)}>Cancel</Button><Button disabled={!paste?.trim()} onClick={() => restore(paste ?? "")}>Restore</Button></>}
      >
        <div className="flex gap-2">
          <Chip selected={!replace} onClick={() => setReplace(false)}>Merge</Chip>
          <Chip selected={replace} onClick={() => setReplace(true)}>Replace</Chip>
        </div>
        <TextField multiline value={paste ?? ""} onChange={setPaste} placeholder='{"version":3,"app":"OmniCalc",...}' />
      </Modal>
    </>
  );
}
