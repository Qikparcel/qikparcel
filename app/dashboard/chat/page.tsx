"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ChattableParcel {
  id: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  other_party_name: string | null;
}

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
  is_me: boolean;
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedParcelId = searchParams.get("parcel");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [parcels, setParcels] = useState<ChattableParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedParcel = parcels.find((p) => p.id === selectedParcelId);

  useEffect(() => {
    async function load() {
      const supabaseClient = createSupabaseClient();
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single<Profile>();

      if (!profileData) {
        router.push("/login");
        return;
      }
      setProfile(profileData);

      if (profileData.role === "sender") {
        const res = await fetch("/api/parcels");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load parcels");
          setLoading(false);
          return;
        }
        const all = (data.parcels || []).filter(
          (p: { status: string; matched_trip_id?: string | null }) =>
            p.status === "matched" && p.matched_trip_id
        );
        setParcels(
          all.map((p: Record<string, unknown>) => {
            const courier = p.courier as { full_name?: string } | undefined;
            return {
              id: p.id as string,
              pickup_address: (p.pickup_address as string) || "",
              delivery_address: (p.delivery_address as string) || "",
              status: (p.status as string) || "",
              other_party_name: courier?.full_name || "Courier",
            };
          })
        );
      } else if (profileData.role === "courier") {
        const res = await fetch("/api/courier/matched-parcels");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load parcels");
          setLoading(false);
          return;
        }
        const all = (data.parcels || []).filter(
          (p: { status: string }) => p.status === "matched"
        );
        setParcels(
          all.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            pickup_address: (p.pickup_address as string) || "",
            delivery_address: (p.delivery_address as string) || "",
            status: (p.status as string) || "",
            other_party_name:
              (p.sender as { full_name?: string })?.full_name || "Sender",
          }))
        );
      } else {
        setParcels([]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  // Open first chat by default when parcels load
  useEffect(() => {
    if (!loading && parcels.length > 0 && !selectedParcelId) {
      router.replace(`/dashboard/chat?parcel=${parcels[0].id}`);
    }
  }, [loading, parcels, selectedParcelId, router]);

  // Fetch thread and messages when parcel selected
  useEffect(() => {
    if (!selectedParcelId) {
      setThreadId(null);
      setMessages([]);
      setChatError(null);
      return;
    }

    let cancelled = false;
    setChatLoading(true);
    setChatError(null);

    fetch(`/api/chat/thread?parcel_id=${encodeURIComponent(selectedParcelId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error && !data.thread) {
          setChatError(data.error);
          setMessages([]);
          setThreadId(null);
          return;
        }
        setThreadId(data.thread?.id ?? null);
        setMessages(data.messages ?? []);
        setChatError(data.error ?? null);
        if (data.thread?.id) {
          fetch("/api/chat/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thread_id: data.thread.id }),
          }).then(() => window.dispatchEvent(new CustomEvent("chat-read")));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChatError("Failed to load chat");
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedParcelId]);

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
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const isMe = user?.id === newMsg.sender_id;
          let senderName = "Unknown";
          try {
            const res = await fetch(
              `/api/chat/sender-name?sender_id=${encodeURIComponent(
                newMsg.sender_id
              )}&thread_id=${encodeURIComponent(newMsg.thread_id)}`
            );
            const data = await res.json();
            if (res.ok && data.full_name) senderName = data.full_name;
          } catch {
            // keep "Unknown" on error
          }
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id)
              ? prev
              : [
                  ...prev,
                  {
                    ...newMsg,
                    sender_name: senderName,
                    is_me: isMe,
                  },
                ]
          );
          // Mark as read when we receive a message while viewing — keeps last_read_at fresh
          // so we don't get WhatsApp notifications when we're actively chatting
          if (!isMe && newMsg.thread_id) {
            fetch("/api/chat/mark-read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ thread_id: newMsg.thread_id }),
            }).then(() => window.dispatchEvent(new CustomEvent("chat-read")));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [threadId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
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
        setChatInput("");
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
        setChatError(data.error || "Failed to send");
      }
    } catch {
      setChatError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-12rem)] flex flex-col sm:flex-row bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        {/* Sidebar - conversation list */}
        <aside className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-gray-200 flex-shrink-0 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {parcels.length} conversation{parcels.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {parcels.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                <p>No matched parcels yet.</p>
                <p className="mt-1">
                  Chat is available when a parcel is matched.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-block text-primary-600 hover:underline"
                  style={{ color: "#29772F" }}
                >
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              parcels.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/chat?parcel=${p.id}`}
                  className={`block p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                    selectedParcelId === p.id ? "bg-primary-50" : ""
                  }`}
                  style={
                    selectedParcelId === p.id
                      ? { backgroundColor: "rgba(41, 119, 47, 0.08)" }
                      : {}
                  }
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.other_party_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {p.pickup_address?.substring(0, 35)}
                    {p.pickup_address && p.pickup_address.length > 35
                      ? "…"
                      : ""}{" "}
                    → {p.delivery_address?.substring(0, 25)}
                    {p.delivery_address && p.delivery_address.length > 25
                      ? "…"
                      : ""}
                  </p>
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {!selectedParcelId ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50/50 p-8">
              <div className="text-center max-w-sm">
                <div className="mx-auto w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  Select a conversation
                </h3>
                <p className="text-sm text-gray-500">
                  Choose a parcel from the list to view and send messages
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-gray-900 truncate">
                    {selectedParcel?.other_party_name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    Parcel: {selectedParcel?.pickup_address?.substring(0, 40)}
                    {selectedParcel?.pickup_address &&
                    selectedParcel.pickup_address.length > 40
                      ? "…"
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/dashboard/parcels/${selectedParcelId}`}
                  className="text-xs font-medium text-primary-600 hover:underline flex-shrink-0 ml-2"
                  style={{ color: "#29772F" }}
                >
                  View parcel
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                  </div>
                ) : chatError && !threadId ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-amber-800">{chatError}</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">
                      No messages yet. Start the conversation!
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.is_me ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            m.is_me
                              ? "bg-primary-600 text-white rounded-br-md"
                              : "bg-gray-100 text-gray-900 rounded-bl-md"
                          }`}
                          style={m.is_me ? { backgroundColor: "#29772F" } : {}}
                        >
                          {!m.is_me && (
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              {m.sender_name}
                            </p>
                          )}
                          <p className="text-sm break-words">{m.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              m.is_me ? "text-white/80" : "text-gray-500"
                            }`}
                          >
                            {new Date(m.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="p-4 border-t border-gray-200 bg-white"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={sending || !threadId || chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={
                      sending || !chatInput.trim() || !threadId || chatLoading
                    }
                    className="px-5 py-3 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
                    style={{ backgroundColor: "#29772F" }}
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
