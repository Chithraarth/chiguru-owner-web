import { ShieldAlert } from "lucide-react";

export function AiDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 ${className}`}>
      <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-800 leading-relaxed">
        <span className="font-semibold">Safety &amp; disclaimer.</span> This is AI guidance,
        not a guarantee. <span className="font-semibold">Confirm with an agronomist for chemical
        recommendations</span> before buying or spraying. Always follow the dose and safety on the
        product label, wear gloves and a mask while spraying, test on a few plants first, and keep
        children, animals and food away. Chiguru is not responsible for any crop, health or
        other loss from acting on this advice. For serious problems, confirm with your nearest KVK
        (Krishi Vigyan Kendra) or agriculture officer before spraying.
      </p>
    </div>
  );
}
