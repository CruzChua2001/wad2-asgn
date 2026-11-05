import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "CruzControl — Public Exposure, Made Clear";
const description =
  "Understand the public security signals around your website and projects, with clear findings and practical next steps.";

export const metadata = {
  // Link previews need full image URLs, so they point at the production site
  metadataBase: new URL("https://cruz-control-wad2-app.vercel.app"),
  title,
  description,
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "48x48" }],
  },
  openGraph: {
    title,
    description,
    siteName: "CruzControl",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="light"
      // The inline script below may switch data-theme before hydration; keep the DOM's value.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
