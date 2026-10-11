"use client";

import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmAction, EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { type Note, useFinanceMutation, useNotes } from "@/lib/queries";

function NoteItem({ n }: { n: Note }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(n.content);
  const [confirm, setConfirm] = useState(false);
  const save = useFinanceMutation((content: string) => api.put(`/notes/${n.id}`, { content }), { success: "Note saved" });
  const del = useFinanceMutation(() => api.delete(`/notes/${n.id}`), { success: "Note deleted" });
  return (
    <Card>
      <CardContent className="grid gap-2">
        {editing ? (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Edit note" autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setText(n.content); setEditing(false); }}>Cancel</Button>
              <Button size="sm" disabled={!text.trim() || save.isPending} onClick={async () => { await save.mutateAsync(text.trim()); setEditing(false); }}>Save</Button>
            </div>
          </>
        ) : (
          <>
            {/* Rendered as text, never HTML (fixes the legacy innerHTML XSS). */}
            <p className="text-sm break-words whitespace-pre-wrap">{n.content}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDate(n.created_at.slice(0, 10))}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit note" onClick={() => setEditing(true)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={() => setConfirm(true)}><Trash2 /></Button>
              </div>
            </div>
          </>
        )}
        <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Delete this note?" description="This can't be undone." onConfirm={() => del.mutateAsync(undefined)} />
      </CardContent>
    </Card>
  );
}

export default function NotesPage() {
  const q = useNotes();
  const [draft, setDraft] = useState("");
  const add = useFinanceMutation((content: string) => api.post("/notes", { content }), { success: "Note added" });
  return (
    <>
      <PageHeader title="Notes" description="Reminders and scratch notes, carried over from the previous app." />
      <Card className="mb-6">
        <CardContent className="grid gap-2">
          <label htmlFor="new-note" className="text-sm font-medium">New note</label>
          <Textarea id="new-note" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write something to remember…" />
          <div className="flex justify-end">
            <Button disabled={!draft.trim() || add.isPending} onClick={async () => { await add.mutateAsync(draft.trim()); setDraft(""); }}>Add note</Button>
          </div>
        </CardContent>
      </Card>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isPending ? <LoadingRows rows={3} /> : !q.data.length ? (
        <EmptyState icon={NotebookPen} title="No notes yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map((n) => <NoteItem key={n.id} n={n} />)}</div>
      )}
    </>
  );
}
