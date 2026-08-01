import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Bot, User, Plus, Trash2, MessageSquare, Loader2, Sprout } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { apiFetch, apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AiDisclaimer } from "@/components/ai-disclaimer";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";

interface Conversation { id: number; title: string; createdAt: string }
interface Message { id: number; conversationId: number; role: string; content: string; createdAt: string }
interface ConversationWithMessages extends Conversation { messages: Message[] }

const QUICK_QUESTIONS = [
  "My crop leaves are turning yellow, what should I do?",
  "When is the best time to apply fertilizer?",
  "How do I control pests without expensive pesticides?",
  "What government schemes are available for farmers?",
  "My soil is hard and not absorbing water well, help?",
  "How do I increase my crop yield this season?",
];

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-primary" : "bg-secondary"
      }`}>
        {isUser ? <User className="h-4 w-4 text-white" /> : <Sprout className="h-4 w-4 text-secondary-foreground" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
      }`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

export default function AgriAI() {
  const [activeId, setActiveId] = useState<number | null>(null);
  useSubScreenHistory(activeId ? 1 : 0, () => setActiveId(null));
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: convList = [] } = useQuery<Conversation[]>({
    queryKey: ["openai-conversations"],
    queryFn: () => apiFetch("/openai/conversations"),
  });

  const { data: active } = useQuery<ConversationWithMessages>({
    queryKey: ["openai-conversation", activeId],
    queryFn: () => apiFetch(`/openai/conversations/${activeId}`),
    enabled: activeId != null,
  });

  const createConv = useMutation({
    mutationFn: (title: string) =>
      apiFetch<Conversation>("/openai/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["openai-conversations"] });
      setActiveId(conv.id);
    },
  });

  const deleteConv = useMutation({
    mutationFn: (id: number) => apiFetch(`/openai/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["openai-conversations"] });
      setActiveId(null);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, streamingText]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    let convId = activeId;
    if (!convId) {
      const shortTitle = text.slice(0, 50);
      const conv = await createConv.mutateAsync(shortTitle);
      convId = conv.id;
    }

    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    qc.setQueryData<ConversationWithMessages>(["openai-conversation", convId], (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, { id: Date.now(), conversationId: convId!, role: "user", content: text, createdAt: new Date().toISOString() }],
      };
    });

    try {
      const response = await fetch(apiUrl(`/openai/conversations/${convId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!response.body) throw new Error("No stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));
          if (json.done) break;
          if (json.error) { toast({ title: "AI error", variant: "destructive" }); break; }
          if (json.content) { fullText += json.content; setStreamingText(fullText); }
        }
      }

      setStreamingText("");
      await qc.invalidateQueries({ queryKey: ["openai-conversation", convId] });
      await qc.invalidateQueries({ queryKey: ["openai-conversations"] });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  }, [activeId, isStreaming, createConv, qc, toast]);

  const messages = active?.messages ?? [];

  if (!activeId) {
    return (
      <PageShell title="Agri Technician AI" back="/" action={
        <Button size="sm" className="bg-white text-primary hover:bg-primary/10 h-8 px-3 text-xs font-semibold"
          onClick={() => createConv.mutateAsync("New conversation")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Chat
        </Button>
      }>
        <div className="p-4 space-y-5">
          {/* Hero */}
          <div className="bg-primary rounded-2xl p-5 text-primary-foreground text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sprout className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold">Your Agri Technician</h2>
            <p className="text-primary-foreground/80 text-sm mt-1 leading-relaxed">
              Expert farming advice powered by AI.<br/>Ask anything about your crops, pests, soil, or government schemes.
            </p>
          </div>

          <AiDisclaimer />

          {/* Quick questions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ask a question</h3>
            <div className="space-y-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left bg-white rounded-xl px-4 py-3 text-sm text-gray-700 border border-gray-100 shadow-sm hover:border-primary/30 hover:bg-primary/10 transition-colors active:scale-98"
                >
                  <span className="text-primary mr-2">💬</span>{q}
                </button>
              ))}
            </div>
          </div>

          {/* Past conversations */}
          {convList.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past conversations</h3>
              <div className="space-y-2">
                {convList.map((c) => (
                  <div key={c.id}
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                    <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <button className="flex-1 text-left text-sm text-gray-700 truncate" onClick={() => setActiveId(c.id)}>
                      {c.title}
                    </button>
                    <button onClick={() => deleteConv.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-gray-300 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={active?.title?.slice(0, 30) ?? "Agri Technician AI"}
      back="/agri-ai"
      action={
        <div className="flex gap-2">
          <button onClick={() => deleteConv.mutate(activeId)}
            className="p-2 rounded-lg hover:bg-primary/90 transition-colors">
            <Trash2 className="h-4 w-4 text-white" />
          </button>
          <button onClick={() => { setActiveId(null); createConv.mutateAsync("New conversation"); }}
            className="p-2 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4 text-white" />
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-[calc(100vh-56px-80px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <Bot className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              Ask me anything about farming…
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isStreaming && streamingText && (
            <MessageBubble
              msg={{ id: -1, conversationId: activeId, role: "assistant", content: streamingText, createdAt: "" }}
              isStreaming
            />
          )}
          {isStreaming && !streamingText && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-4 w-4 text-secondary-foreground animate-spin" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          {messages.length > 0 && <AiDisclaimer className="mt-2" />}
          <div ref={bottomRef} />
        </div>

        {/* Quick chips */}
        {messages.length < 2 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {QUICK_QUESTIONS.slice(0, 3).map((q) => (
              <button key={q} onClick={() => sendMessage(q)}
                className="flex-shrink-0 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1.5 whitespace-nowrap">
                {q.slice(0, 35)}…
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Type your farming question…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-28 overflow-y-auto"
            style={{ height: "auto" }}
            disabled={isStreaming}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="bg-primary hover:bg-primary/90 rounded-xl h-10 w-10 p-0 flex-shrink-0"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
