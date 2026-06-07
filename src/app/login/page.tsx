import { prisma } from "@/lib/prisma";
import { loginAs } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

// Headshots from the marketing site, keyed by first name.
const PHOTOS: Record<string, string> = {
  zain: "/photos/zain.webp",
  alejandro: "/photos/ale.webp",
};

export default async function LoginPage() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex min-h-[88vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-medium text-charcoal">
            Alexander <span className="text-gold">&amp;</span> Associates
          </h1>
          <p className="mt-2 text-sm tracking-wide text-text-light">SALES CRM</p>
        </div>

        {users.length === 0 ? (
          <div className="rounded-lg border border-gold/40 bg-ivory-2 p-4 text-sm text-text-mid">
            No users yet. Run <code className="font-mono">npm run db:seed</code> to create
            Zain and Alejandro.
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const photo = PHOTOS[user.name.toLowerCase()];
              return (
                <form key={user.id} action={loginAs.bind(null, user.id)}>
                  <button
                    type="submit"
                    className="group flex w-full items-center gap-4 rounded-xl border border-ivory-2 bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-gold hover:shadow-md"
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={user.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-ivory-2 group-hover:ring-gold"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-charcoal text-sm font-semibold text-ivory">
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span>
                      <span className="block font-serif text-lg text-charcoal">
                        I&apos;m {user.name}
                      </span>
                      <span className="block text-xs text-text-light">{user.email}</span>
                    </span>
                    <span className="ml-auto text-gold opacity-0 transition-opacity group-hover:opacity-100">
                      →
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
