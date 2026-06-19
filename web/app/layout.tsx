import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "SAP MCP Command Center",
  description:
    "Three synthetic SAP systems behind one MCP gateway. Synthetic data, no SAP connection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
