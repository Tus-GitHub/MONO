"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImageUpload } from "@/components/uploads/image-upload";
import { idleState } from "@/lib/utils/result";
import { saveProfileAction } from "@/server/actions/profile";

interface Props {
  initial: {
    name: string;
    nickname: string | null;
    pronouns: string | null;
    birthday: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileForm({ initial }: Props) {
  const [state, action] = useActionState(saveProfileAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormFeedback state={state} />

      <ImageUpload
        endpoint="/api/uploads/avatar"
        value={avatarUrl}
        onChange={setAvatarUrl}
        shape="circle"
        label="Profile photo"
      />

      <Field label="Name" htmlFor="name" errors={fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={initial.name} autoComplete="name" required />
      </Field>

      <Field label="Nickname" htmlFor="nickname" optional errors={fieldErrors?.nickname}>
        <Input id="nickname" name="nickname" defaultValue={initial.nickname ?? ""} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pronouns" htmlFor="pronouns" optional errors={fieldErrors?.pronouns}>
          <Input id="pronouns" name="pronouns" defaultValue={initial.pronouns ?? ""} />
        </Field>
        <Field label="Birthday" htmlFor="birthday" optional errors={fieldErrors?.birthday}>
          <Input id="birthday" name="birthday" type="date" defaultValue={initial.birthday ?? ""} />
        </Field>
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
