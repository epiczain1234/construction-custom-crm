"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/active-clients", label: "Active Clients" },
  { href: "/warm-leads", label: "Warm Leads" },
  { href: "/call", label: "Call mode" },
];

export function TopNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-charcoal-2 bg-charcoal">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href="/dashboard" className="mr-5 font-serif text-lg font-medium tracking-tight text-ivory">
          Alexander <span className="text-gold">&amp;</span> Associates
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-gold text-charcoal"
                    : "text-ivory-2/80 hover:bg-charcoal-2 hover:text-ivory"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-text-light">
            Signed in as <span className="font-medium text-ivory-2">{userName}</span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-text-light hover:bg-charcoal-2 hover:text-ivory"
            >
              Switch
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
