import { X, Camera } from "lucide-react";
import { fmtMoney, curSymbol } from "@/lib/currency";

/** The minimal loan fields the proof viewer needs, shared by Loans + Attendance. */
export interface ProofLoan {
  workerName?: string | null;
  amount: number | string;
  issuedDate: string;
  createdAt?: string;
  proofPhotoUrl?: string | null;
}

/** Small tappable thumbnail shown on loan rows that carry a proof photo. */
export function ProofBadge({ loan, onView }: { loan: ProofLoan; onView: (l: ProofLoan) => void }) {
  if (!loan.proofPhotoUrl) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onView(loan); }}
      className="flex items-center gap-1.5 mt-2 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1"
    >
      <img src={loan.proofPhotoUrl} alt="Proof of loan" className="h-8 w-8 rounded object-cover" />
      <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
        <Camera className="h-3 w-3" /> Proof of loan
      </span>
    </button>
  );
}

/** Full-screen viewer: the handover photo plus who/how much/when it was recorded. */
export function LoanProofViewer({ loan, onClose }: { loan: ProofLoan; onClose: () => void }) {
  if (!loan.proofPhotoUrl) return null;
  const takenAt = loan.createdAt ? new Date(loan.createdAt) : null;
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-white font-semibold text-sm">Proof of loan</p>
          <p className="text-gray-300 text-xs">
            {loan.workerName ?? "Worker"} · {fmtMoney(Number(loan.amount))}
          </p>
        </div>
        <button onClick={onClose} className="text-white p-2" aria-label="Close">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-3 min-h-0">
        <img
          src={loan.proofPhotoUrl}
          alt="Proof of loan"
          className="max-h-full max-w-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="p-4 text-center">
        <p className="text-gray-200 text-sm font-medium">Loan given on {loan.issuedDate}</p>
        {takenAt && !Number.isNaN(takenAt.getTime()) && (
          <p className="text-gray-400 text-xs mt-0.5">
            Recorded {takenAt.toLocaleDateString("en-IN")} at {takenAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
