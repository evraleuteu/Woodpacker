import type { Metadata } from "next";
import { Manrope, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Woodpacker — Master Any Language Through Intelligent Repetition",
  description: "Upload books, courses, PDFs, audio lessons, and exercises. Woodpacker automatically transforms them into a personalized speaking, listening, reading, and vocabulary mastery system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="h-screen overflow-hidden flex bg-[#FAFBFC] text-[#111827] relative">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
