import { useState } from "react";
import { createPortal } from "react-dom";
import { Star, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMutate } from "@/lib/api";

interface RateAppSheetProps {
  open: boolean;
  onClose: () => void;
}

export function RateAppSheet({ open, onClose }: RateAppSheetProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  function reset() {
    setStars(0);
    setComment("");
  }

  async function handleSubmit() {
    if (stars === 0) return;
    setSending(true);
    try {
      // Reuses the Helpline inbox (as a "suggestion") rather than a separate
      // table — the team already reviews that queue, and a star rating on
      // its own is just a differently-shaped suggestion for them to read.
      const created = await apiMutate("POST", "/help-messages", {
        type: "suggestion",
        message: `⭐ App rating: ${stars}/5${comment.trim() ? `\n\n${comment.trim()}` : ""}`,
      });
      toast({
        title: created ? "Thanks for rating Chiguru! ⭐" : "Saved — will send when internet returns",
      });
      reset();
      onClose();
    } catch {
      toast({ title: "Couldn't send — please try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-4 right-4 bottom-4 max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-5 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-800">Rate Chiguru</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">How's the app working for you?</p>

        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStars(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="p-1"
            >
              <Star
                className={`h-9 w-9 transition-colors ${
                  n <= stars ? "fill-amber-400 text-amber-400" : "text-gray-300"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What do you like, or what should we improve? (optional)"
          rows={3}
          maxLength={2000}
          className="rounded-xl"
        />

        <Button
          onClick={handleSubmit}
          disabled={sending || stars === 0}
          className="w-full mt-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit rating"}
        </Button>
      </div>
    </div>,
    document.body
  );
}
