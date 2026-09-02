import { buttonBase, buttonSizes, buttonVariants } from "@/components/ui/_shared";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

/**
 * Downloads a full JSON export of the couple's data from the authenticated GET route. A plain
 * anchor (not next/link) so the browser handles it as a file download.
 */
export function DataExportCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink">Export your data</p>
      <p className="mt-1 text-sm text-muted">
        One JSON file with every date, memory, review, expense and place the two of you have
        added. Yours to keep.
      </p>
      <a
        href="/api/export"
        download
        className={cn(buttonBase, buttonVariants.secondary, buttonSizes.sm, "mt-4 inline-flex")}
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="upload" size="sm" />
          Download export
        </span>
      </a>
    </div>
  );
}
