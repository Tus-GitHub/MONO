import type { MetadataRoute } from "next";

/**
 * MONO is a private space for two people — there is nothing here for a crawler to index, and
 * date photos in particular must never surface publicly. Disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
