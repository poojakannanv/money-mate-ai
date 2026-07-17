import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MoneyMate AI - your AI personal finance co-pilot",
    template: "%s | MoneyMate AI",
  },
  description:
    "Upload a UK bank statement, get instant AI categorisation, and ask your finances anything in plain English.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
