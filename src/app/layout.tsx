import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { STORAGE_KEY, THEMES } from "@/lib/theme";
import { SessionProvider } from "@/components/SessionProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MenuProvider } from "@/components/MenuContext";
import { Navbar } from "@/components/Navbar";
import { TimerPhaseProvider } from "@/components/TimerPhaseContext";
import { UpdateToast } from "@/components/UpdateToast";

export const metadata: Metadata = {
  title: "CubTimer",
  description: "Strict progress analysis for cstimer exports",
  appleWebApp: {
    capable: true,
    title: "CubTimer",
    statusBarStyle: "black-translucent",
  },
  // Next only emits mobile-web-app-capable; older iOS needs the apple- name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

// viewport-fit=cover lets the installed iOS app draw under the notch and
// home indicator; the navbar and content pad themselves with safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E11" },
  ],
};

const noFlashScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(${JSON.stringify(
  THEMES,
)}.indexOf(t)<0){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        {process.env.VERCEL_GIT_COMMIT_SHA ? (
          <meta name="git-sha" content={process.env.VERCEL_GIT_COMMIT_SHA} />
        ) : null}
      </head>
      <body className="h-full flex flex-col antialiased">
        <MenuProvider>
          <ThemeProvider>
            <AuthProvider>
              <SessionProvider>
                <TimerPhaseProvider>
                  <Navbar />
                  <div className="safe-area-content flex-1 overflow-auto">
                    {children}
                  </div>
                  <UpdateToast />
                </TimerPhaseProvider>
              </SessionProvider>
            </AuthProvider>
          </ThemeProvider>
        </MenuProvider>
        <Analytics />
      </body>
    </html>
  );
}
