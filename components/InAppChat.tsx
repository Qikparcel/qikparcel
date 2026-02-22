"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
  is_me: boolean;
};

interface InAppChatProps {
  parcelId: string;
  otherPartyName?: string;
  className?: string;
}

export default function InAppChat({
  parcelId,
  otherPartyName = "Courier",
  className = "",
}: InAppChatProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch thread and messages
  useEffect(() => {
    if (!parcelId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/chat/thread?parcel_id=${encodeURIComponent(parcelId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error && !data.thread) {
          setError(data.error);
          setMessages([]);
          setThreadId(null);
          return;
        }
        setThreadId(data.thread?.id ?? null);
        setMessages(data.messages ?? []);
        setError(data.error ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError("Failed to load chat");
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [parcelId]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            thread_id: string;
            sender_id: string;
            content: string;
            created_at: string;
          };
          // Fetch sender name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", newMsg.sender_id)
            .single<{ full_name: string | null }>();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id)
              ? prev
              : [
                  ...prev,
                  {
                    ...newMsg,
                    sender_name: profile?.full_name || "Unknown",
                    is_me: user?.id === newMsg.sender_id,
                  },
                ]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !threadId || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, content: text }),
      });
      const data = await res.json();

      if (res.ok && data.message) {
        setInput("");
        // Realtime will add the message; optionally add optimistically
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setMessages((prev) => [
          ...prev,
          {
            id: data.message.id,
            thread_id: threadId,
            sender_id: data.message.sender_id,
            content: data.message.content,
            created_at: data.message.created_at,
            sender_name: "You",
            is_me: true,
          },
        ]);
      } else {
        setError(data.error || "Failed to send");
      }
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}
      >
        <p className="text-sm text-gray-500">Loading chat…</p>
      </div>
    );
  }

  if (error && !threadId) {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-amber-50 p-4 ${className}`}
      >
        <p className="text-sm text-amber-800">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-200 bg-white ${className}`}
    >
      <div className="border-b border-gray-200 px-4 py-2">
        <h3 className="text-sm font-medium text-gray-900">
          Chat with {otherPartyName}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[320px]">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.is_me ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  m.is_me
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
                style={m.is_me ? { backgroundColor: "#29772F" } : {}}
              >
                {!m.is_me && (
                  <p className="text-xs font-medium text-gray-600 mb-0.5">
                    {m.sender_name}
                  </p>
                )}
                <p className="text-sm break-words">{m.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    m.is_me ? "text-white/80" : "text-gray-500"
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={sending || !threadId}
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || !threadId}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: "#29772F" }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
