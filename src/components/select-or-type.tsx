import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_SENTINEL = "__type_own__";

interface SelectOrTypeProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  typePlaceholder?: string;
  labels?: Record<string, string>;
}

export function SelectOrType({
  options,
  value,
  onChange,
  placeholder,
  typePlaceholder = "Type your own…",
  labels,
}: SelectOrTypeProps) {
  const [typing, setTyping] = useState(
    () => value !== "" && !options.includes(value),
  );

  useEffect(() => {
    if (value !== "") {
      setTyping(!options.includes(value));
    }
  }, [value, options]);

  const selectValue = typing ? TYPE_SENTINEL : value;

  return (
    <div>
      <Select
        value={selectValue || undefined}
        onValueChange={(v) => {
          if (v === TYPE_SENTINEL) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger className="mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labels?.[o] ?? o}
            </SelectItem>
          ))}
          <SelectItem value={TYPE_SENTINEL}>
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <PenLine className="h-3.5 w-3.5" /> Type your own
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {typing && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={typePlaceholder}
          className="mt-2"
          autoFocus
        />
      )}
    </div>
  );
}
