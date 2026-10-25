import { renderAppIcon } from "@/lib/appIcon";

// PWA manifest icons, rendered once at build time.
// Maskable: launchers crop to a shape inside the central 80% circle, so the
// logo is kept small enough (56%) that its whole box fits in that circle.
// Keep in sync with the icons listed in src/app/manifest.ts.
const PWA_ICONS = {
  "icon-192.png": { size: 192, logoScale: 132 / 180 },
  "icon-512.png": { size: 512, logoScale: 132 / 180 },
  "icon-512-maskable.png": { size: 512, logoScale: 0.56 },
} as const;

type IconFile = keyof typeof PWA_ICONS;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PWA_ICONS).map((file) => ({ file }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const icon = PWA_ICONS[file as IconFile];
  if (!icon) return new Response("Not found", { status: 404 });
  return renderAppIcon(icon.size, icon.logoScale);
}
