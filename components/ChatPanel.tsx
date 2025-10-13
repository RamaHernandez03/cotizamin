// components/ChatPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Send, Loader2 } from "lucide-react";
import { subscribeToConversation } from "@/lib/chat-realtime";

type Msg = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
};

const AZUL = "#00152F";

export default function ChatPanel({
  conversationId,
  onRead,
}: {
  conversationId: string;
  onRead?: () => void;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages/${conversationId}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setMsgs(data.items);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markRead() {
    await fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {});
    onRead?.();
  }

  useEffect(() => {
    load().then(markRead);
  }, [conversationId]);

  useEffect(() => {
    const unsub = subscribeToConversation(conversationId, (m: Msg) => {
      setMsgs((prev) => [...prev, m]);
      markRead();
    });
    return () => {
      unsub();
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;

    setText("");
    setSending(true);

    const temp: Msg = {
      id: `tmp-${Date.now()}`,
      conversationId,
      senderId: currentUserId || "me",
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMsgs((prev) => [...prev, temp]);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      if (!res.ok) {
        setMsgs((prev) => prev.filter((x) => x.id !== temp.id));
      }
    } catch (error) {
      setMsgs((prev) => prev.filter((x) => x.id !== temp.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function formatTime(iso: string) {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  }

  const isMyMessage = (senderId: string) => senderId === currentUserId || senderId === "me";

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No hay mensajes todavía
          </div>
        ) : (
          <>
            {msgs.map((m, idx) => {
              const isMine = isMyMessage(m.senderId);
              const showTime =
                idx === 0 ||
                new Date(m.createdAt).getTime() - new Date(msgs[idx - 1].createdAt).getTime() >
                  300000; // 5 min

              return (
                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                    {showTime && (
                      <div className="text-[10px] text-gray-400 mb-1 px-2">
                        {formatTime(m.createdAt)}
                      </div>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words ${
                        isMine
                          ? "rounded-tr-md text-white"
                          : "rounded-tl-md text-gray-800 bg-white border border-gray-200"
                      }`}
                      style={isMine ? { backgroundColor: AZUL } : {}}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input de mensaje */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Escribí tu mensaje..."
              disabled={sending}
              className="w-full rounded-2xl text-blue-800 border border-gray-300 px-4 py-2.5 pr-12 focus:outline-none focus:border-[#00152F] focus:ring-2 focus:ring-[#00152F]/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all"
            />
          </div>
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ backgroundColor: AZUL }}
            aria-label="Enviar mensaje"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}