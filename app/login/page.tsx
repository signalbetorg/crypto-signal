'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function friendlyAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed')) return 'Check your email to confirm your account.';
  if (msg.includes('rate limit')) return 'Too many attempts. Try again in a minute.';
  return 'Something went wrong. Try again.';
}

const FEATURES = [
  { label: 'Live BUY / SELL signals', sub: 'Breakout + momentum on 15m candles, trend-confirmed on 1h' },
  { label: 'Multi-exchange', sub: 'Binance, Bybit, Coinbase, Upbit — switch anytime' },
  { label: 'Push notifications', sub: 'Signals delivered instantly, even when the tab is closed' },
  { label: 'Backtest-validated', sub: '65–75% direction accuracy across BTC, ETH, SOL, XRP' },
];

function MarketingPanel() {
  return (
    <div className="flex flex-col justify-center px-10 py-12">
      {/* Brand */}
      <div className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-500/70 mb-3">Crypto Signal</p>
        <h2 className="text-3xl font-bold text-zinc-100 leading-tight tracking-tight">
          Real-time signals.<br />No noise.
        </h2>
        <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
          Technical analysis on live crypto data — get precise BUY/SELL signals before the move happens.
        </p>
      </div>

      {/* Features */}
      <ul className="space-y-5 mb-10">
        {FEATURES.map((f) => (
          <li key={f.label} className="flex gap-3">
            <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200">{f.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{f.sub}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Mock signal card */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs text-zinc-400">BTC / USDT · 15m</span>
          <span className="font-mono text-[10px] text-zinc-600">SAMPLE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold tracking-widest">
            BUY
          </span>
          <div className="flex gap-3 text-xs font-mono text-zinc-400">
            <span>Target <span className="text-emerald-400">+5.0%</span></span>
            <span>Stop <span className="text-red-400">-1.5%</span></span>
            <span>Conf <span className="text-zinc-200">82</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  async function handleGitHubLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className="w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {/* Top accent line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

          {/* Left: marketing */}
          <div className="hidden lg:block border-r border-zinc-800/60">
            <MarketingPanel />
          </div>

          {/* Right: login form */}
          <div className="px-8 py-10 flex flex-col justify-center">
            {/* Mobile-only brand */}
            <div className="lg:hidden mb-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-500/70 mb-1">Crypto Signal</p>
              <p className="text-xs text-zinc-500">Real-time BUY/SELL signals for crypto traders.</p>
            </div>

            <div className="mb-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-2 hidden lg:block">Crypto Signal</p>
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Sign in</h1>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-3 mb-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30 transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30 transition-colors"
              />
              {error && (
                <div className="rounded-lg bg-red-950/20 border border-red-800/40 px-3 py-2">
                  <p className="text-red-400 text-xs font-mono">{friendlyAuthError(error)}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-100 text-zinc-900 text-sm font-mono font-semibold py-2.5 rounded-lg hover:bg-white transition-colors disabled:opacity-40"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <button
              onClick={handleGitHubLogin}
              disabled={loading}
              className="w-full bg-zinc-900 border border-zinc-700/50 text-zinc-300 text-sm font-mono py-2.5 rounded-lg hover:bg-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-40 mb-6"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Continue with GitHub
              </span>
            </button>

            <p className="text-center text-zinc-600 text-xs font-mono">
              No account?{' '}
              <Link href="/signup" className="text-zinc-300 hover:text-zinc-100">
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
