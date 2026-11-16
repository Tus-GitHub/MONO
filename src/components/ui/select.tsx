"use client";

import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { controlSize, disabledControl, focusRing, type ControlSize } from "./_shared";
import { useBackButton } from "./_dialog-primitives";
import { Icon } from "./icon";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> {
  uiSize?: ControlSize;
  invalid?: boolean;
}
interface Choice { value: string; label: string; disabled: boolean; group?: string }
function labelText(children: ReactNode): string {
  return Children.toArray(children).map((child) => isValidElement<{ children?: ReactNode }>(child) ? labelText(child.props.children) : String(child)).join("");
}
function choicesFrom(children: ReactNode, group?: string, groupDisabled = false): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return [];
    if (child.type === "option") return [{ value: String(child.props.value ?? labelText(child.props.children)), label: child.props.label ?? labelText(child.props.children), disabled: groupDisabled || !!child.props.disabled, group }];
    if (child.type === "optgroup" || child.type === Fragment) return choicesFrom(child.props.children, child.props.label ?? group, groupDisabled || !!child.props.disabled);
    return [];
  });
}

/** Custom keyboard/touch menu; the hidden native control retains form and change-event semantics. */
export function Select({ className, uiSize = "md", invalid, children, value, defaultValue, onChange, id: providedId, disabled, ...props }: SelectProps) {
  const autoId = useId(), id = providedId ?? autoId;
  const [validation, setValidation] = useState("");
  const choices = choicesFrom(children);
  const [local, setLocal] = useState(() => String(defaultValue ?? choices.find((choice) => !choice.disabled)?.value ?? ""));
  const selected = value !== undefined ? String(value) : choices.some((choice) => choice.value === local) ? local : choices[0]?.value ?? "";
  const [open, setOpen] = useState(false);
  const native = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useBackButton(() => setOpen(false), open);
  useEffect(() => {
    const form = native.current?.form;
    let frame = 0;
    const reset = () => { frame = requestAnimationFrame(() => { setLocal(native.current?.value ?? ""); setValidation(""); }); };
    form?.addEventListener("reset", reset);
    return () => { form?.removeEventListener("reset", reset); cancelAnimationFrame(frame); };
  }, []);
  const choose = (encoded: string) => {
    const select = native.current;
    if (!select || select.matches(":disabled")) return;
    select.value = encoded.slice(2);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  return <div className="relative min-w-0">
    <select {...props} ref={native} id={id ? `${id}-native` : undefined} disabled={disabled}
      className="mono-native-control" tabIndex={-1} aria-hidden="true" value={value} defaultValue={defaultValue}
      onFocus={() => trigger.current?.focus()}
      onInvalid={(event) => { event.preventDefault(); setValidation(event.currentTarget.validationMessage); trigger.current?.focus(); props.onInvalid?.(event); }}
      onChange={(event) => { setValidation(""); setLocal(event.target.value); onChange?.(event); }}>{children}</select>
    <SelectPrimitive.Root open={open} onOpenChange={setOpen} value={`v:${selected}`} onValueChange={choose} disabled={disabled}>
      <SelectPrimitive.Trigger ref={trigger} id={id} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]}
        aria-describedby={[props["aria-describedby"], validation && `${id}-validation`].filter(Boolean).join(" ") || undefined} aria-invalid={!!validation || invalid || props["aria-invalid"] || undefined} aria-required={props.required || undefined}
        className={cn("mono-select-trigger flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 text-left text-ink shadow-xs transition-colors hover:border-primary/50 data-[state=open]:border-primary data-[state=open]:bg-primary-tint/30", controlSize[uiSize], focusRing, disabledControl, invalid && "border-error", className)}>
        <span className="min-w-0 truncate"><SelectPrimitive.Value placeholder="Choose an option" /></span>
        <SelectPrimitive.Icon className="shrink-0 text-muted"><Icon name="chevronDown" size="sm" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" align="start" sideOffset={6} collisionPadding={12} className="mono-select-menu rounded-2xl border border-line bg-elevated p-1.5 text-ink shadow-xl"
          onEscapeKeyDown={(event) => event.stopPropagation()}>
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-muted"><Icon name="chevronUp" size="sm" /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>{choices.map((choice, index) => <Fragment key={choice.value}>
            {choice.group && choices[index - 1]?.group !== choice.group ? <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted">{choice.group}</p> : null}
            <SelectPrimitive.Item value={`v:${choice.value}`} disabled={choice.disabled} textValue={choice.label}
              className="relative flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl py-2 pl-3 pr-10 text-sm outline-none data-[highlighted]:bg-primary-tint data-[highlighted]:text-primary data-[state=checked]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:opacity-40">
              <SelectPrimitive.ItemText>{choice.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="absolute right-3 text-primary"><Icon name="check" size="sm" /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          </Fragment>)}</SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-muted"><Icon name="chevronDown" size="sm" /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    {validation ? <p role="alert" id={`${id}-validation`} className="mt-1.5 text-xs text-error">{validation}</p> : null}
  </div>;
}
