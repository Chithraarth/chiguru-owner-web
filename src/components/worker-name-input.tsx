import { useState } from "react";
import { Input } from "@/components/ui/input";

export interface WorkerOption {
  id: number;
  name: string;
}

/**
 * A worker picker you can just type into — no "Type new worker" menu step.
 * Typing shows matching existing workers to tap; an exact name match links
 * automatically; any other name becomes a brand-new worker on save.
 */
export function WorkerNameInput({
  workers,
  value,
  onChange,
  placeholder = "Type worker name",
}: {
  workers: WorkerOption[];
  value: string;
  onChange: (name: string, workerId: number | null) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const q = value.trim().toLowerCase();
  const exact = workers.find((w) => w.name.trim().toLowerCase() === q);
  const matches = (q
    ? workers.filter((w) => w.name.toLowerCase().includes(q))
    : workers
  ).slice(0, 6);
  const showList = focused && (matches.length > 0 || (q.length > 0 && !exact));

  function resolve(name: string) {
    const m = workers.find(
      (w) => w.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    onChange(name, m ? m.id : null);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => resolve(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="mt-1"
      />
      {showList && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
          {matches.map((w) => (
            <button
              key={w.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(w.name, w.id);
                setFocused(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 active:bg-gray-100 hover:bg-gray-50"
            >
              {w.name}
            </button>
          ))}
          {q.length > 0 && !exact && (
            <div className="px-3 py-2 text-xs text-primary bg-primary/10 border-t border-gray-100">
              ✏️ “{value.trim()}” will be saved as a new worker
            </div>
          )}
        </div>
      )}
    </div>
  );
}
