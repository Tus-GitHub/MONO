"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZodTypeAny } from "zod";

/** Use the server's schema to gate a form, including values restored/autofilled on hydration. */
export function useFormValidity(schema: Pick<ZodTypeAny, "safeParse">) {
  const formRef = useRef<HTMLFormElement>(null);
  const [valid, setValid] = useState(false);
  const validate = useCallback(() => {
    if (formRef.current) {
      setValid(schema.safeParse(Object.fromEntries(new FormData(formRef.current))).success);
    }
  }, [schema]);
  useEffect(() => { validate(); }, [validate]);
  return { formRef, valid, validate };
}
