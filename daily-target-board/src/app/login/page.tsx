import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Daily Target Board</h1>
      <p className="mt-1 text-sm text-slate-600">Sign in to see your targets.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Synthetic demo accounts only. Every demo account uses the password Demo@12345.
      </p>
    </main>
  );
}