'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Fitelo CRM';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Login failed');
      } else {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || '/';
        window.location.href = next;
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-amber-50 via-emerald-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to</h1>
          <div className="text-2xl font-semibold bg-gradient-to-r from-emerald-500 to-amber-500 bg-clip-text text-transparent">
            {appName}
          </div>
        </div>

        <h2 className="text-xl font-semibold text-center mb-4">Sign in</h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          Enter your credentials to access the dashboard
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 transition disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
