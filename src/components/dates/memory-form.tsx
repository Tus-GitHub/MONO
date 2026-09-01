"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PhotoView } from "@/lib/date/photo-view";
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

      <Field label="Title" htmlFor="memory-title" errors={fieldErrors?.title}>
        <Input
          id="memory-title"
          name="title"
          defaultValue={memory?.title ?? dateTitle}
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
          defaultValue={memory?.body ?? ""}
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
