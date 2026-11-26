import type { Metadata } from "next";
import { Geist_Mono, Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-bengali",
  weight: ["400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Shikor (শিকড়) — Family Trees & Living Kinship Maps",
    template: "%s | Shikor (শিকড়)",
  },
  description:
    "Collaborative family tree visualization, cultural kinship calculator, and living family directory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${hindSiliguri.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            {children}
          </TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
