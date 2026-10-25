import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// PNG app icons (iOS home screen, PWA manifest) are rendered at build time
// from the SVG logo, the same file as the favicon (src/app/icon.svg).
export const ICON_BACKGROUND = "#0B0E11";

const logo = readFileSync(join(process.cwd(), "src/app/icon.svg"));
const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;

/**
 * The logo centred on a square `#0B0E11` tile.
 * `logoScale` is the logo's width as a fraction of the tile.
 */
export function renderAppIcon(size: number, logoScale: number): ImageResponse {
  const logoSize = Math.round(size * logoScale);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ICON_BACKGROUND,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={logoSize} height={logoSize} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
