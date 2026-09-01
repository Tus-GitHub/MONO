import "server-only";

import { env, isProduction } from "@/config/env";
import { NoopImageProcessor } from "@/lib/images/noop-processor";
import { SharpImageProcessor } from "@/lib/images/sharp-processor";
import type { ImageProcessor } from "@/lib/images/types";

export type { ImageProcessor, ProcessedImage, RenderedImage, ImageVariant } from "@/lib/images/types";

function createProcessor(): ImageProcessor {
  return env.IMAGE_PROCESSOR === "noop"
    ? new NoopImageProcessor()
    : new SharpImageProcessor();
}

const globalForImages = globalThis as unknown as { imageProcessor?: ImageProcessor };

export const imageProcessor: ImageProcessor =
  globalForImages.imageProcessor ?? createProcessor();

if (!isProduction) globalForImages.imageProcessor = imageProcessor;
