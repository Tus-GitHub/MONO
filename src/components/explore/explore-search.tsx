"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchInput } from "@/components/ui/search";

/** Search box that keeps `?q=` in the URL so the server component re-queries. */
export function ExploreSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <SearchInput
      value={value}
      onValueChange={setValue}
      placeholder="Search places, areas, or activities"
    />
  );
}
