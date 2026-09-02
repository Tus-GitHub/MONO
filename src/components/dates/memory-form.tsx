"use client";

import { useActionState, useEffect, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { OfflineNotice } from "@/components/system/offline-notice";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PhotoView } from "@/lib/date/photo-view";
import { useLocalDraft } from "@/lib/hooks/use-local-draft";
import { idleState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import { deleteMemoryAction, saveMemoryAction } from "@/server/actions/post-date";

interface Memory {
  id: string;
  title: string;
  body: string;
  isFavorite: boolean;
  coverPhotoId: string | null;
}

export function MemoryForm({
  dateId,
  dateTitle,
  photos,
  memory,
}: {
  dateId: string;
  dateTitle: string;
  photos: PhotoView[];
  memory: Memory | null;
}) {
  const [state, action] = useActionState(saveMemoryAction, idleState);
  const [, deleteAction] = useActionState(deleteMemoryAction, idleState);
  const confirm = useConfirm();
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const [cover, setCover] = useState<string>(memory?.coverPhotoId ?? "");

  // Keep the two long text fields on the device so a crash / lost connection doesn't lose them.
  const titleDraft = useLocalDraft(`mono:memory:${dateId}:title`, memory?.title ?? dateTitle);
  const bodyDraft = useLocalDraft(`mono:memory:${dateId}:body`, memory?.body ?? "");

  useEffect(() => {
    if (state.status === "success") {
      titleDraft.clear();
      bodyDraft.clear();
    }
    // clear() is stable; only react to a save landing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const removeMemory = async () => {
    const ok = await confirm({
      title: "Remove this memory?",
      description: "The date and its photos stay — just the written memory goes.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("dateId", dateId);
    deleteAction(fd);
  };

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="dateId" value={dateId} />
      <input type="hidden" name="coverPhotoId" value={cover} />

      <FormFeedback state={state} />
      <OfflineNotice />

      {(titleDraft.restored || bodyDraft.restored) && state.status !== "success" ? (
        <p className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          <Icon name="refresh" size={13} className="shrink-0" />
          Picked up where you left off — this is an unsaved local draft.
        </p>
      ) : null}

      <Field label="Title" htmlFor="memory-title" errors={fieldErrors?.title}>
        <Input
          id="memory-title"
          name="title"
          value={titleDraft.value}
          onChange={(e) => titleDraft.setValue(e.target.value)}
          placeholder="Name this memory"
          maxLength={160}
          required
        />
      </Field>

      <Field label="The story" htmlFor="memory-body" errors={fieldErrors?.body}>
        <Textarea
          id="memory-body"
          name="body"
          rows={6}
          value={bodyDraft.value}
          onChange={(e) => bodyDraft.setValue(e.target.value)}
          placeholder="Tell it like you'd tell a friend. What happened, what you felt, the bit you'll both bring up years from now."
          required
        />
      </Field>

      {photos.length > 0 ? (
        <div className="space-y-2">
          <span className="text-sm font-medium text-ink">Cover photo</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setCover("")}
              className={cn(
                "grid aspect-square place-items-center rounded-lg border text-xs",
                cover === "" ? "border-primary bg-primary-tint text-primary" : "border-line text-muted",
              )}
            >
              None
            </button>
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setCover(photo.id)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border",
                  cover === photo.id ? "border-primary ring-2 ring-ring/40" : "border-line",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl}
                  alt={photo.caption ?? ""}
                  loading="lazy"
                  className="size-full object-cover"
                />
                {cover === photo.id ? (
                  <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-fg">
                    <Icon name="check" size={12} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <CheckboxField
        label="Mark as a favourite memory"
        name="isFavorite"
        defaultChecked={memory?.isFavorite ?? false}
      />

      <div className="flex items-center justify-between gap-2 border-t border-line pt-5">
        {memory ? (
          <Button type="button" variant="ghost" size="sm" onClick={removeMemory}>
            Remove memory
          </Button>
        ) : (
          <span />
        )}
        <SubmitButton pendingText="Saving…">
          {memory ? "Update memory" : "Keep this memory"}
        </SubmitButton>
      </div>
    </form>
  );
}
