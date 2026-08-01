import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HelpCircle, Lightbulb, Send, Loader2, MessageCircleQuestion,
  CheckCircle2, Clock, LifeBuoy, Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate } from "@/lib/api";

interface HelpMessage {
  id: number;
  type: "question" | "suggestion";
  message: string;
  phone: string | null;
  status: "open" | "replied";
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export default function HelpPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [type, setType] = useState<"question" | "suggestion">("question");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages = [], isLoading } = useQuery<HelpMessage[]>({
    queryKey: ["help-messages"],
    queryFn: () => apiFetch("/help-messages"),
    // Answers arrive in the background — poll while one is pending.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((m) => m.type === "question" && !m.reply) ? 4000 : false,
  });

  async function handleSend() {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const created = await apiMutate("POST", "/help-messages", {
        type,
        message: text,
        phone: phone.trim() || undefined,
      });
      setMessage("");
      qc.invalidateQueries({ queryKey: ["help-messages"] });
      if (type === "question") {
        toast({
          title: created
            ? "Sent ✅ — Helpline is replying below"
            : "Saved — will be answered when internet returns",
          description: created
            ? "Your answer will appear in a few seconds."
            : undefined,
        });
      } else {
        toast({
          title: created ? "Suggestion sent ✅" : "Saved — will send when internet returns",
          description: "Thank you! The Chiguru team will review it and update you here.",
        });
      }
    } catch {
      toast({
        title: "Couldn't send — please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell title="Helpline & Suggestions" back="/">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-10">
        {/* Intro */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
          <div className="bg-primary text-primary-foreground rounded-xl p-2.5 flex-shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-primary">We're here to help</h2>
            <p className="text-sm text-primary/80 mt-0.5">
              Ask a question and the Chiguru helpline replies within seconds. Send a suggestion
              and the Chiguru team will review it and update you right here.
            </p>
          </div>
        </div>

        {/* Send a message */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("question")}
              className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1.5 transition-colors ${
                type === "question"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-gray-200 text-gray-500"
              }`}
            >
              <HelpCircle className="w-6 h-6" />
              <span className="text-sm font-semibold">Ask a question</span>
            </button>
            <button
              onClick={() => setType("suggestion")}
              className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1.5 transition-colors ${
                type === "suggestion"
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-gray-200 text-gray-500"
              }`}
            >
              <Lightbulb className="w-6 h-6" />
              <span className="text-sm font-semibold">Give a suggestion</span>
            </button>
          </div>

          <div>
            <Label htmlFor="help-message" className="text-xs text-gray-500">
              {type === "question" ? "What do you need help with? *" : "What should we improve? *"}
            </Label>
            <Textarea
              id="help-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "question"
                  ? "e.g. How do I move a worker to another group?"
                  : "e.g. Please add a weekly wage report I can print"
              }
              rows={4}
              maxLength={2000}
              className="rounded-xl mt-1"
            />
          </div>

          <div>
            <Label htmlFor="help-phone" className="text-xs text-gray-500">
              Phone number (optional — if you want a call back)
            </Label>
            <Input
              id="help-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 98765 43210"
              maxLength={20}
              className="rounded-xl h-12 mt-1"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                {type === "question" ? "Send question" : "Send suggestion"}
              </span>
            )}
          </Button>
        </section>

        {/* Previous messages */}
        <section className="space-y-2">
          <h3 className="font-semibold text-gray-700 text-sm px-1">Your messages</h3>
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
              Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <MessageCircleQuestion className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No messages yet. Ask us anything — we're happy to help.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  {m.type === "suggestion" ? (
                    <Lightbulb className="w-4 h-4 text-accent flex-shrink-0" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {m.type === "suggestion" ? "Suggestion" : "Question"}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{m.message}</p>

                {m.reply ? (
                  <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-primary">
                      {m.type === "question" ? (
                        <Sparkles className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span className="text-xs font-semibold">
                        {m.type === "question" ? "Reply from Chiguru Helpline" : "Update from Chiguru team"}
                      </span>
                    </div>
                    <p className="text-sm text-primary mt-1.5 whitespace-pre-wrap">{m.reply}</p>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-1.5 text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs">
                      {m.type === "question"
                        ? "Chiguru Helpline is preparing your reply — it will appear here shortly"
                        : "With the Chiguru team — updates will appear here"}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </PageShell>
  );
}
