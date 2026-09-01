import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StyleGallery } from "@/components/style/style-gallery";
import { isDevelopment } from "@/config/env";

export const metadata: Metadata = { title: "Style" };

/** Living reference for the design system. Development only — 404s in production. */
export default function StylePage() {
  if (!isDevelopment) notFound();
  return <StyleGallery />;
}
