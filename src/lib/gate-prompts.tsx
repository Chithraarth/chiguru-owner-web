// Toasts for when the server refuses an action because of the plan
// (SUBSCRIPTION_REQUIRED) or the wallet (WALLET_EMPTY) - kept in one place
// so the owner pages (lib/api.ts) and the invitee pages (invitee/api.ts)
// explain it the same way the mobile app does.
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export interface GateBody {
  message?: string;
  code?: string;
  price?: number;
  balance?: number;
}

export const isGateCode = (code?: string) => code === "SUBSCRIPTION_REQUIRED" || code === "WALLET_EMPTY";

let lastPromptAt = 0;
// One action can fire several requests; never stack the same prompt.
function throttled() {
  if (Date.now() - lastPromptAt < 3000) return true;
  lastPromptAt = Date.now();
  return false;
}

function walletLine(body: GateBody | null) {
  const need = body?.price != null ? `This needs ₹${body.price}` : "This AI feature needs wallet credit";
  const have = body?.balance != null ? ` and the wallet has ₹${Math.floor(body.balance)}` : "";
  return `${need}${have}.`;
}

/** Own farm: offer to go recharge. */
export function promptWalletRecharge(body: GateBody | null, openWallet: () => void) {
  if (throttled()) return;
  toast({
    title: "Wallet balance too low",
    description: `${walletLine(body)} Recharge your wallet to continue.`,
    action: (
      <ToastAction altText="Recharge wallet" onClick={openWallet}>
        Recharge wallet
      </ToastAction>
    ),
  });
}

/** Invited farm: the plan and wallet are the owner's, so only they can fix it. */
export function promptAskOwner(body: GateBody | null) {
  if (throttled()) return;
  toast(
    body?.code === "WALLET_EMPTY"
      ? { title: "Wallet balance too low", description: `${walletLine(body)} Ask the farm owner to recharge their Chiguru wallet.`, variant: "destructive" }
      : { title: "Farm owner's plan isn't active", description: "Ask the farm owner to renew their Chiguru plan to use this.", variant: "destructive" },
  );
}
