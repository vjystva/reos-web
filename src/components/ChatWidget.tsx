"use client";

import * as React from "react";
import { usePathname, useParams } from "next/navigation";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import type {
  AssistantChatMessage,
  AssistantPageContext,
} from "@/types/api";

const SESSION_KEY = "reos_assistant_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Derive page context from the current route so the assistant can default
 * project/lead ids without the user restating them.
 */
function usePageContext(): AssistantPageContext {
  const pathname = usePathname();
  const params = useParams();

  return React.useMemo(() => {
    const ctx: AssistantPageContext = {};
    if (pathname) ctx.path = pathname;

    const projectId = params?.projectId;
    if (typeof projectId === "string") ctx.project_id = projectId;

    // Lead pages use [id] under /dashboard/leads or carry an explicit leadId.
    const leadId = params?.leadId;
    if (typeof leadId === "string") {
      ctx.lead_id = leadId;
    } else if (
      pathname?.includes("/leads/") &&
      typeof params?.id === "string"
    ) {
      ctx.lead_id = params.id;
    }
    return ctx;
  }, [pathname, params]);
}

interface UiMessage extends AssistantChatMessage {
  error?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "How many hot leads do I have?",
  "Give me a summary of my dashboard.",
];

export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [suggestions, setSuggestions] =
    React.useState<string[]>(DEFAULT_SUGGESTIONS);

  const panelRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const pageContext = usePageContext();
  const chat = useAssistantChat();

  // Auto-scroll to newest message.
  React.useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, chat.isPending]);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const send = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chat.isPending) return;

      const nextMessages: UiMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];
      setMessages(nextMessages);
      setInput("");

      const wireMessages: AssistantChatMessage[] = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      chat.mutate(
        {
          session_id: getSessionId(),
          messages: wireMessages,
          page_context: pageContext,
        },
        {
          onSuccess: (data) => {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.reply },
            ]);
            if (data.suggested_questions?.length) {
              setSuggestions(data.suggested_questions);
            }
          },
          onError: (err) => {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: err.message || "Something went wrong.",
                error: true,
              },
            ]);
          },
        },
      );
    },
    [messages, chat, pageContext],
  );

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9998,
          width: "56px",
          height: "56px",
          borderRadius: "9999px",
          border: "none",
          background: "#1e293b",
          color: "#ffffff",
          fontSize: "22px",
          cursor: "pointer",
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span aria-hidden="true">{open ? "×" : "✨"}</span>
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="AI assistant"
          style={{
            position: "fixed",
            bottom: "92px",
            right: "24px",
            zIndex: 9998,
            width: "380px",
            maxWidth: "calc(100vw - 32px)",
            height: "540px",
            maxHeight: "calc(100vh - 120px)",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
              AI assistant
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AI assistant"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
                color: "#64748b",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div
            ref={bodyRef}
            style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}
          >
            {messages.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 12px" }}>
                Ask me about your leads, inventory, or dashboard. I can only read
                data — I can&apos;t make changes.
              </p>
            )}

            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {messages.map((m, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 12px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      background:
                        m.role === "user"
                          ? "#1e293b"
                          : m.error
                            ? "#fef2f2"
                            : "#f1f5f9",
                      color:
                        m.role === "user"
                          ? "#ffffff"
                          : m.error
                            ? "#b91c1c"
                            : "#0f172a",
                    }}
                  >
                    {m.content}
                  </div>
                </li>
              ))}
            </ul>

            {chat.isPending && (
              <div style={{ color: "#94a3b8", fontSize: "13px", padding: "4px 0" }}>
                Thinking&hellip;
              </div>
            )}

            {/* Suggested questions */}
            {!chat.isPending && suggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    style={{
                      fontSize: "12px",
                      color: "#334155",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "9999px",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            style={{
              borderTop: "1px solid #e2e8f0",
              padding: "10px 12px",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Message the AI assistant"
              style={{
                flex: 1,
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={chat.isPending || !input.trim()}
              style={{
                background: "#1e293b",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "13px",
                cursor: chat.isPending || !input.trim() ? "not-allowed" : "pointer",
                opacity: chat.isPending || !input.trim() ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
