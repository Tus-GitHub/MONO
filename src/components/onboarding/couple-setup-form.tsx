"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImageUpload } from "@/components/uploads/image-upload";
import { idleState } from "@/lib/utils/result";
import { completeCoupleSetupAction } from "@/server/actions/couple";

interface Props {
  initial: {
    name: string | null;
    description: string | null;
    anniversaryAt: string | null; // yyyy-mm-dd
    photoUrl: string | null;
  };
}

export function CoupleSetupForm({ initial }: Props) {
  const [state, action] = useActionState(completeCoupleSetupAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormFeedback state={state} />

      <ImageUpload
        endpoint="/api/uploads/couple-cover"
        value={photoUrl}
        onChange={setPhotoUrl}
        shape="cover"
        label="Space photo"
        hint="Optional — a photo of the two of you works well."
      />

      <Field label="Space name" htmlFor="name" optional errors={fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          defaultValue={initial.name ?? ""}
          placeholder="Us"
          maxLength={80}
        />
      </Field>

      <Field
        label="Relationship date"
        htmlFor="anniversaryAt"
        optional
        hint="When it began — an anniversary, a first date."
        errors={fieldErrors?.anniversaryAt}
      >
        <Input
          id="anniversaryAt"
          name="anniversaryAt"
          type="date"
          defaultValue={initial.anniversaryAt ?? ""}
        />
      </Field>

      <Field label="Description" htmlFor="description" optional errors={fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial.description ?? ""}
          rows={3}
          maxLength={500}
          placeholder="A line about the two of you."
        />
      </Field>

      <SubmitButton fullWidth pendingText="Saving…">
        Finish setup
      </SubmitButton>
    </form>
  );
}
