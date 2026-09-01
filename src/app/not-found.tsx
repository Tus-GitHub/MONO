import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-faint">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">This page doesn&apos;t exist</h1>
      </div>
      <LinkButton href="/" variant="secondary">
        Go home
      </LinkButton>
    </div>
  );
}
