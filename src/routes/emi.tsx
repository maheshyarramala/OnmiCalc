import { createFileRoute } from "@tanstack/react-router";
import { Calculator, Landmark } from "lucide-react";
import { TabBar } from "@/components/omni/ui";
import { EmiCalculatorView } from "@/features/emi/EmiCalculatorView";
import { LoanTrackerView } from "@/features/emi/LoanTrackerView";

type Tab = "CALCULATOR" | "TRACKER";

export const Route = createFileRoute("/emi")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({ tab: s["tab"] === "TRACKER" ? "TRACKER" : s["tab"] === "CALCULATOR" ? "CALCULATOR" : undefined }),
  head: () => ({
    meta: [
      { title: "EMI Calculator & Loan Tracker — OmniCalc" },
      { name: "description", content: "Calculate loan EMIs with prepayments and full amortization, and track active loans with EMI payments." },
      { property: "og:title", content: "EMI Calculator & Loan Tracker — OmniCalc" },
      { property: "og:description", content: "Loan EMI, amortization schedule, prepayment savings and active loan tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmiPage,
});

function EmiPage() {
  const { tab = "CALCULATOR" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <TabBar
        tabs={[
          { id: "CALCULATOR", title: "EMI Calculator", icon: Calculator },
          { id: "TRACKER", title: "Active Loans Tracker", icon: Landmark },
        ]}
        value={tab}
        onChange={(t) => navigate({ search: { tab: t }, replace: true })}
      />
      {tab === "CALCULATOR" ? <EmiCalculatorView /> : <LoanTrackerView />}
    </>
  );
}
