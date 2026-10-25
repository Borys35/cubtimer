import type { MetadataRoute } from "next";
import { ICON_BACKGROUND } from "@/lib/appIcon";

export const dynamic = "force-static";

// Icons are rendered by src/app/icons/[file]/route.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CubTimer",
    short_name: "CubTimer",
    description: "Strict progress analysis for cstimer exports",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: ICON_BACKGROUND,
    theme_color: ICON_BACKGROUND,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
