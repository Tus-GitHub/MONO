"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";

import { BareInput, InputGroup } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
}

/** Search field with icon and a clear affordance. Controlled or uncontrolled. */
export function SearchInput({
  value,
  defaultValue,
  onValueChange,
  onClear,
  placeholder = "Search",
  className,
  id,
  ...props
}: SearchInputProps) {
  const autoId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = isControlled ? value : internal;

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <InputGroup
      className={cn("px-3", className)}
      leading={<Icon name="search" size="sm" />}
      trailing={
        current ? (
          <button
            type="button"
            aria-label="Clear search"
            className="tap -mr-1 grid place-items-center rounded-full text-muted transition-colors hover:text-ink"
            onClick={() => {
              setValue("");
              onClear?.();
              inputRef.current?.focus();
            }}
          >
            <Icon name="x" size="sm" />
          </button>
        ) : null
      }
    >
      <BareInput
        ref={inputRef}
        id={id ?? autoId}
        type="search"
        role="searchbox"
        placeholder={placeholder}
        value={current}
        onChange={(event) => setValue(event.target.value)}
        className="[&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
    </InputGroup>
  );
}
