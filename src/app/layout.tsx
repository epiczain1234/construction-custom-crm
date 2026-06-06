import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Construction CRM",
  description: "Cold-calling CRM for the team",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {user && <TopNav userName={user.name} />}
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}
