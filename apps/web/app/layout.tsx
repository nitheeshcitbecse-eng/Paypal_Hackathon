import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "PayPal AgentGuard",
  description: "Keep autonomous purchases safe with PayPal AgentGuard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
