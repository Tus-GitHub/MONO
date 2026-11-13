"use client";

import { PendingFields } from "@/components/forms/pending-fields";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UniqueNameField } from "@/components/forms/unique-name-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { UnsavedGuard } from "@/components/system/unsaved-guard";
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
  const [dismissedState, setDismissedState] = useState<typeof state>();
  const [nameValid, setNameValid] = useState(false);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);

  return (
    <form action={action} onChange={() => setDismissedState(state)}
      onSubmit={(event) => { if (!nameValid) event.preventDefault(); }}
      onReset={(event) => event.preventDefault()} className="space-y-5" noValidate>
      <PendingFields className="space-y-5">
        <UnsavedGuard state={state} />
        <FormFeedback state={dismissedState === state ? idleState : state} />

        <ImageUpload
          endpoint="/api/uploads/avatar"
          value={avatarUrl}
          onChange={setAvatarUrl}
          shape="circle"
          label="Profile photo"
        />

        <UniqueNameField initial={initial.name} errors={fieldErrors?.name} onValidityChange={setNameValid} />

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

        <SubmitButton disabled={!nameValid} pendingText="Saving…">Save changes</SubmitButton>
      </PendingFields>
    </form>
  );
}
