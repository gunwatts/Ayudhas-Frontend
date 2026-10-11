"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Inbox, MailCheck, MailOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError, type Schemas } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { useSession } from "@/lib/session";

type Message = Schemas["ContactOut"];
type MessagePage = { items: Message[]; total: number; page: number; page_size: number };

const TOPIC: Record<string, string> = {
  question: "Question",
  feedback: "Feedback",
  suggestion: "Product suggestion",
  collaboration: "Collaboration",
  bug: "Bug report",
  business: "Business inquiry",
};

function useMessageAction<T>(fn: (v: T) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["messages"] });
      if (success) toast.success(success);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Something went wrong"),
  });
}

function MessageCard({ m }: { m: Message }) {
  const [confirm, setConfirm] = useState(false);
  const mark = useMessageAction((is_read: boolean) => api.patch(`/contact/messages/${m.id}`, { is_read }));
  const del = useMessageAction(() => api.delete(`/contact/messages/${m.id}`), "Message deleted");
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(m.email);
      toast.success("Email address copied");
    } catch {
      toast.error("Couldn't copy. Select the address instead.");
    }
  };
  return (
    <Card className={m.is_read ? "opacity-80" : "border-primary/40"}>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!m.is_read && <Badge>New</Badge>}
          <Badge variant="secondary">{TOPIC[m.topic] ?? m.topic}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(m.created_at.slice(0, 10))} · {m.created_at.slice(11, 16)} UTC</span>
        </div>
        <div className="min-w-0">
          <p className="font-medium">{m.name}</p>
          <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span className="select-all break-all">{m.email}</span>
            <Button variant="ghost" size="icon-sm" aria-label={`Copy ${m.email}`} onClick={copyEmail}><Copy /></Button>
          </p>
        </div>
        {/* Rendered as plain text: messages come from the public internet. */}
        <p className="text-sm break-words whitespace-pre-wrap">{m.message}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" disabled={mark.isPending} onClick={() => mark.mutate(!m.is_read)}>
            {m.is_read ? <><MailOpen /> Mark unread</> : <><MailCheck /> Mark read</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>
        </div>
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Delete this message?" description="This can't be undone." onConfirm={() => del.mutateAsync(undefined)} />
      </CardContent>
    </Card>
  );
}

export default function MessagesPage() {
  const { user } = useSession();
  const [view, setView] = useState<"unread" | "all">("unread");
  const q = useQuery({
    queryKey: ["messages", view],
    queryFn: ({ signal }) => api.get<MessagePage>("/contact/messages", { unread: view === "unread" ? "true" : undefined, page_size: 100 }, signal),
    enabled: !!user?.is_staff,
  });

  if (!user?.is_staff) {
    return <EmptyState title="Not available" description="This page is only for the site owner." />;
  }
  return (
    <>
      <PageHeader title="Messages" description="Sent from the contact form on ayudhas.com." />
      <Tabs value={view} onValueChange={(v) => setView(v as "unread" | "all")} className="mb-4">
        <TabsList>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {q.isPending ? (
        <LoadingRows rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={Inbox} title={view === "unread" ? "No unread messages" : "No messages yet"} description="Messages from the ayudhas.com contact form appear here." />
      ) : (
        <div className="grid gap-3">
          {q.data.items.map((m) => <MessageCard key={m.id} m={m} />)}
        </div>
      )}
    </>
  );
}
