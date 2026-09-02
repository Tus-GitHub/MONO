"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { UnsavedGuard } from "@/components/system/unsaved-guard";
import { ImageUpload } from "@/components/uploads/image-upload";
import { idleState } from "@/lib/utils/result";
import { updateCoupleProfileAction } from "@/server/actions/settings";

interface Props {
  initial: {
    name: string | null;
    description: string | null;
    anniversaryAt: string | null; // yyyy-mm-dd
    currency: string;
    photoUrl: string | null;
  };
}

export function CoupleProfileForm({ initial }: Props) {
  const [state, action] = useActionState(updateCoupleProfileAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl);

  return (
    <form action={action} className="space-y-5" noValidate>
      <UnsavedGuard />
      <FormFeedback state={state} />

      <ImageUpload
        endpoint="/api/uploads/couple-cover"
        value={photoUrl}
        onChange={setPhotoUrl}
        shape="cover"
        label="Couple photo"
        hint="Optional — a photo of the two of you."
      />

      <Field label="Couple name" htmlFor="name" optional errors={fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={initial.name ?? ""} placeholder="Us" maxLength={80} />
      </Field>

      <Field label="About" htmlFor="description" optional errors={fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial.description ?? ""}
          rows={3}
          maxLength={500}
          placeholder="A line about the two of you."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Relationship date"
          htmlFor="anniversaryAt"
          optional
          errors={fieldErrors?.anniversaryAt}
        >
          <Input
            id="anniversaryAt"
            name="anniversaryAt"
            type="date"
            defaultValue={initial.anniversaryAt ?? ""}
          />
        </Field>
        <Field label="Currency" htmlFor="currency" errors={fieldErrors?.currency}>
          <Input
            id="currency"
            name="currency"
            defaultValue={initial.currency}
            maxLength={3}
            className="uppercase"
            placeholder="USD"
          />
        </Field>
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
