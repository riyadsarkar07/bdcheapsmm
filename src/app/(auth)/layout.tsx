import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />

      <div className="relative z-10 mb-8">
        <Logo className="justify-center text-lg" />
      </div>
      <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
