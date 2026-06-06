import { prisma } from "@/lib/prisma";
import { loginAs } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-slate-900">
          Construction CRM
        </h1>
        <p className="mb-8 text-center text-sm text-slate-500">Who&apos;s using it?</p>

        {users.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No users yet. Run <code className="font-mono">npm run db:seed</code> to create
            Zain and Alejandro.
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <form key={user.id} action={loginAs.bind(null, user.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-slate-900 hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900">
                      I&apos;m {user.name}
                    </span>
                    <span className="block text-xs text-slate-500">{user.email}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
