import { Button } from "@/components/ui/button";
import { Modal } from "@/components/omni/ui";
import { useUi } from "@/lib/ui-store";
import { copyText } from "@/lib/share";

const UPI = "maheshyarramala@ybl";

export function AppInfoDialog() {
  const info = useUi((s) => s.info);
  const openInfo = useUi((s) => s.openInfo);
  const close = () => openInfo(null);
  const titles = {
    ABOUT: "About OmniCalc",
    TERMS: "Terms & Conditions",
    PRIVACY: "Privacy Policy",
    CONTACT: "Contact Us & Feedback",
    DONATE: "Support Developer",
  } as const;
  return (
    <Modal open={!!info} onOpenChange={(o) => !o && close()} title={info ? titles[info] : ""} footer={<Button variant="ghost" onClick={close}>Close</Button>}>
      <div className="space-y-3 text-sm leading-relaxed">
        {info === "ABOUT" && (
          <>
            <p>OmniCalc is an all-in-one financial, loan tracking, and utility calculation suite.</p>
            <p className="font-semibold">Credits & Developer:</p>
            <p>Developed by Mahesh Yarramala</p>
            <Button variant="tonal" asChild>
              <a href="https://instagram.com/mahes.yarramala" target="_blank" rel="noreferrer">Instagram: @mahes.yarramala</a>
            </Button>
          </>
        )}
        {info === "TERMS" && (
          <>
            <p className="font-semibold">Terms & Conditions:</p>
            <p>1. All calculations provided by OmniCalc are for informational and planning purposes only.</p>
            <p>2. Financial figures, interest calculations, and bank EMI deductions should be verified with your respective banking institution.</p>
          </>
        )}
        {info === "PRIVACY" && (
          <>
            <p className="font-semibold">Privacy Policy:</p>
            <p>1. Data Collection: OmniCalc operates primarily offline. All calculations, loan details, and financial logs are stored locally on your device.</p>
            <p>2. Notifications: Reminders for EMI, card bills and lending due dates are shown inside the app.</p>
            <p>3. Third-party Sharing: Personal user data is not sold, rented, or shared with third-party advertisers.</p>
          </>
        )}
        {info === "CONTACT" && (
          <>
            <p>We value your suggestions and feedback!</p>
            <p className="font-semibold">Email:</p>
            <p>devops.maheshbabu@gmail.com</p>
            <Button variant="tonal" asChild>
              <a href={`mailto:devops.maheshbabu@gmail.com?subject=${encodeURIComponent("OmniCalc Feedback / Support")}`}>Send Feedback Email</a>
            </Button>
          </>
        )}
        {info === "DONATE" && (
          <>
            <p>If OmniCalc helped you organize your finances, consider supporting ongoing development!</p>
            <p className="font-semibold">UPI ID: {UPI}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => copyText(UPI, "UPI ID copied.")}>Copy UPI ID</Button>
              <Button variant="tonal" asChild>
                <a href={`upi://pay?pa=${UPI}&pn=Mahesh%20Yarramala&cu=INR`}>Open UPI App</a>
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
