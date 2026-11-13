"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";

import { ConfirmationController } from "@/lib/state/confirmation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new ConfirmationController<ConfirmOptions>());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const options = state.stage === "awaiting" ? state.options : null;
  useEffect(() => () => controller.dispose(), [controller]);
  const confirm = useCallback<ConfirmFn>((options) => controller.request(options), [controller]);
  const settle = useCallback((value: boolean) => controller.settle(value), [controller]);
  const finishHistoryClose = useCallback((stayedOnPage: boolean) => controller.historyClosed(stayedOnPage), [controller]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => settle(false)}
        onHistoryClosed={finishHistoryClose}
        title={options?.title}
        description={options?.description}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={options?.tone === "danger" ? "danger" : "primary"}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>.");
  return ctx;
}
