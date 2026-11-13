import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Target Board",
  description: "A prototype for daily targets, progress and verification",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-900">
          Prototype · synthetic data only · not connected to any bank system
        </div>
        {children}
      </body>
    </html>
  );
}