import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <h1 className="text-lg font-semibold tracking-tight">KaguOs</h1>
        </div>
        <p className="mb-6 text-sm text-muted">
          Kagu&apos;s internal system. Sign in with your team account.
        </p>
        <LoginForm />
        <p className="mt-6 text-[13px] text-faint">
          No account? Accounts are created by an admin — ask Parsa.
        </p>
      </div>
    </main>
  );
}
