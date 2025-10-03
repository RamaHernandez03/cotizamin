// lib/chat-realtime.ts
import { sb } from "@/lib/supabase-browser";

export function subscribeToConversation(conversationId: string, onInsert: (msg:any)=>void) {
  const channel = sb.channel(`conv:${conversationId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'Message', filter: `conversationId=eq.${conversationId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => { sb.removeChannel(channel); };
}
