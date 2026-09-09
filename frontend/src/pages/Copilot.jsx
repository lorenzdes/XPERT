import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { api } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles } from "lucide-react";

const SESSION_KEY = "copilot_session_id";

function getSessionId() {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `sess_${Math.random().toString(36).slice(2)}${Date.now()}`;
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

const CHIPS = [
  "Quali fatture sono scadute?",
  "Qual è il totale incassato finora?",
  "Riepilogo del bilancio 2024",
  "Previsione incassi prossimo trimestre",
];

function renderMarkdown(text) {
  // minimal: bold + line breaks + bullets
  return text.split("\n").map((line, idx) => {
    const bolded = line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
    return (
      <p key={idx} className={isBullet ? "pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-accent" : ""}>
        {isBullet ? bolded.map((b, i) => (typeof b === "string" ? b.replace(/^[-*]\s/, "") : b)) : bolded}
      </p>
    );
  });
}

export default function Copilot() {
  const { companyId } = useCompany();
  const sessionId = useRef(getSessionId());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get(`/copilot/history?session_id=${sessionId.current}`).then((r) => setMessages(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const resp = await fetch(`${API}/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId.current, message: content, company_id: companyId }),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            if (data.delta) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + data.delta };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Errore di connessione. Riprova." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col" data-testid="copilot-view">
      <div className="mb-4">
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-accent" /> CRM Copilot AI
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Interroga il CRM TeamSystem in linguaggio naturale · GPT-5.4</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                <Bot className="h-7 w-7" />
              </div>
              <div>
                <p className="font-heading font-semibold text-lg">Come posso aiutarti?</p>
                <p className="text-sm text-muted-foreground mt-1">Chiedimi di fatture, incassi, PEC o bilanci.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {CHIPS.map((c) => (
                  <button key={c} onClick={() => sendMessage(c)} data-testid={`copilot-chip-${c.slice(0, 8)}`}
                    className="text-sm px-3 py-1.5 rounded-full border border-border hover:border-accent hover:text-accent transition-colors">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                m.role === "user" ? "bg-[#0B132B] text-white" : "bg-accent/10 text-accent"}`}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm space-y-1 ${
                m.role === "user" ? "bg-[#0B132B] text-white" : "bg-muted"}`}
                data-testid={`copilot-msg-${m.role}`}>
                {m.content ? renderMarkdown(m.content) : (
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Scrivi un messaggio..."
              disabled={streaming} data-testid="copilot-input" />
            <Button type="submit" disabled={streaming || !input.trim()} data-testid="copilot-send-btn">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
