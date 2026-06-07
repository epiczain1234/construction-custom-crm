import type { Metadata } from "next";
import { Inter, EB_Garamond } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { getCurrentUser } from "@/lib/session";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-eb-garamond" });

export const metadata: Metadata = {
  title: "Alexander & Associates — CRM",
  description: "Sales CRM for the Alexander & Associates team",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${inter.variable} ${ebGaramond.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {user && <TopNav userName={user.name} />}
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}
