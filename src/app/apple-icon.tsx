import { renderAppIcon } from "@/lib/appIcon";

// iOS home-screen icons must be PNG, so render the SVG logo onto a square
// tile at build time (132px logo on a 180px tile).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width, 132 / 180);
}
