'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useProfile, type TradingType, type Exchange } from '@/hooks/useProfile';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, loading, updateTradingType, updateExchange, refreshProfile } = useProfile();
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [pushLoading, setPushLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<TradingType>('spot');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<Exchange>('binance');
  const [savingExchange, setSavingExchange] = useState(false);
  const [savedExchange, setSavedExchange] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setEmail(user.email ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) setSelected(profile.trading_type);
  }, [profile]);

  useEffect(() => {
    if (profile) setSelectedExchange(profile.exchange);
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    await updateTradingType(selected);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExchangeSave() {
    setSavingExchange(true);
    await updateExchange(selectedExchange);
    setSavingExchange(false);
    setSavedExchange(true);
    setTimeout(() => setSavedExchange(false), 2000);
  }

  async function handleUpgrade() {
    setUpgrading(true);
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setUpgrading(false);
  }

  async function handleManageSubscription() {
    setUpgrading(true);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setUpgrading(false);
  }

  async function handleSimulateDowngrade() {
    await fetch('/api/stripe/test-downgrade', { method: 'POST' });
    await refreshProfile();
  }

  async function handlePushToggle() {
    setPushLoading(true);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setPushLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch('/api/account', { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json();
      setDeleteError(body.error ?? 'Failed to delete account');
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 overflow-y-auto">
      <div
        className={`w-full max-w-md mx-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_0_40px_rgba(0,0,0,0.5)] px-6 py-8 transition-all duration-300 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/" className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-zinc-100 text-xl font-mono font-bold">Settings</h1>
        </div>
        {email && <p className="text-zinc-600 text-xs font-mono mb-8 ml-7">{email}</p>}

        {loading ? (
          <div className="animate-pulse space-y-3 mb-6">
            <div className="h-3 w-24 bg-zinc-800/40 rounded" />
            <div className="h-12 bg-zinc-800/40 rounded-lg" />
            <div className="h-12 bg-zinc-800/40 rounded-lg" />
            <div className="h-9 bg-zinc-800/40 rounded-lg mt-4" />
          </div>
        ) : (
          <>
            <div className="border-t border-zinc-800/50 pt-6 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-3">Plan</p>
            </div>
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-950 px-4 py-4 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-zinc-100 font-semibold flex items-center gap-2">
                    {profile?.tier === 'pro' ? (
                      <>
                        Pro
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wide">Pro</span>
                      </>
                    ) : (
                      <span className="text-zinc-400">Free</span>
                    )}
                  </p>
                  <p className="text-zinc-500 text-xs font-mono mt-0.5">
                    {profile?.tier === 'pro'
                      ? 'All coins · Push notifications'
                      : 'BTC only · No push notifications'}
                  </p>
                </div>
                {profile?.tier === 'pro' ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={upgrading}
                    className="px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50"
                  >
                    {upgrading ? '...' : 'Manage'}
                  </button>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="px-3 py-1.5 text-xs font-mono rounded-lg bg-zinc-100 text-zinc-900 font-semibold hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {upgrading ? '...' : 'Upgrade'}
                  </button>
                )}
              </div>
            </div>
            <div className="border-t border-zinc-800/50 mt-4 mb-6" />

            <div className="border-t border-zinc-800/50 pt-6 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-3">Trading Mode</p>
            </div>

            <div className="space-y-2 mb-6">
              <button
                onClick={() => setSelected('spot')}
                className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors ${selected === 'spot'
                  ? 'border-zinc-600 bg-zinc-800'
                  : 'border-zinc-700/40 bg-zinc-950 hover:border-zinc-600'
                  }`}
              >
                <p className="text-sm font-mono text-zinc-100 font-semibold">Spot Trading</p>
                <p className="text-xs font-mono text-zinc-600 mt-0.5">BUY signals only</p>
              </button>

              <button
                onClick={() => setSelected('futures')}
                className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors ${selected === 'futures'
                  ? 'border-zinc-600 bg-zinc-800'
                  : 'border-zinc-700/40 bg-zinc-950 hover:border-zinc-600'
                  }`}
              >
                <p className="text-sm font-mono text-zinc-100 font-semibold">Futures / Margin</p>
                <p className="text-xs font-mono text-zinc-600 mt-0.5">BUY + SELL signals</p>
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-zinc-100 text-zinc-900 text-sm font-mono font-semibold py-2.5 rounded-xl disabled:opacity-40 mb-3 hover:bg-white transition-colors"
            >
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </button>
            {saved && <p className="text-emerald-400 text-xs font-mono text-center mt-1">Saved</p>}

            <div className="border-t border-zinc-800/50 mt-6 pt-6 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-3">Data Source</p>
            </div>
            <div className="space-y-2 mb-3">
              {(['binance', 'coinbase', 'upbit', 'bybit'] as Exchange[]).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setSelectedExchange(ex)}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors ${
                    selectedExchange === ex
                      ? 'border-zinc-600 bg-zinc-800'
                      : 'border-zinc-700/40 bg-zinc-950 hover:border-zinc-600'
                  }`}
                >
                  <p className="text-sm font-mono text-zinc-100 font-semibold capitalize">{ex.charAt(0).toUpperCase() + ex.slice(1)}</p>
                  <p className="text-xs font-mono text-zinc-600 mt-0.5">
                    {ex === 'binance' && 'USD pairs · Real-time kline stream'}
                    {ex === 'coinbase' && 'USD pairs · No BNB · REST polling'}
                    {ex === 'upbit' && 'KRW pairs · No BNB · REST polling'}
                    {ex === 'bybit' && 'USD pairs · All coins · REST polling'}
                  </p>
                </button>
              ))}
            </div>
            <button
              onClick={handleExchangeSave}
              disabled={savingExchange}
              className="w-full bg-zinc-900 border border-zinc-700/50 text-zinc-300 text-sm font-mono font-semibold py-2.5 rounded-xl disabled:opacity-40 mb-3 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
            >
              {savingExchange ? 'Saving...' : savedExchange ? 'Saved' : 'Save Exchange'}
            </button>
            {savedExchange && <p className="text-emerald-400 text-xs font-mono text-center mt-1">Saved</p>}
          </>
        )}

        {/* Push Notifications */}
        <div className="border-t border-zinc-800/50 pt-6 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-3">Notifications</p>
          {profile?.tier !== 'pro' ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-zinc-300">Push Notifications</p>
                <p className="text-xs font-mono text-zinc-600 mt-0.5">Pro plan required</p>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="px-3 py-1.5 text-xs font-mono rounded-lg bg-zinc-100 text-zinc-900 font-semibold hover:bg-white transition-colors disabled:opacity-50"
              >
                {upgrading ? '...' : 'Upgrade'}
              </button>
            </div>
          ) : permission === 'denied' ? (
            <p className="text-xs text-red-400 font-mono">
              Notifications blocked by browser. Enable in browser settings.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    {isSubscribed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />}
                    <p className="text-sm text-zinc-300 font-mono">Push Notifications</p>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {isSubscribed ? 'Active — Signals with confidence ≥50' : 'Off'}
                  </p>
                </div>
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50"
                >
                  {pushLoading ? '...' : isSubscribed ? 'Disable' : 'Enable'}
                </button>
              </div>
              {isSubscribed && (
                <button
                  onClick={() =>
                    fetch('/api/push/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'BUY',
                        symbol: 'BTCUSDT',
                        confidence: 80,
                        price: 95000,
                        target: 96900,
                      }),
                    })
                  }
                  className="mt-2 px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700/30 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Send test notification
                </button>
              )}
            </>
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="w-full bg-zinc-950 border border-zinc-700/40 text-zinc-500 text-sm font-mono py-2.5 rounded-xl hover:bg-zinc-900 hover:border-zinc-600 transition-colors mb-8"
        >
          Sign out
        </button>

        {/* Delete account */}
        <div className="border-t border-zinc-800/50 pt-6">
          <p className="text-zinc-700 text-[10px] uppercase tracking-widest font-mono mb-3">Danger Zone</p>

          {process.env.NODE_ENV !== 'production' && profile?.tier === 'pro' && (
            <button
              onClick={handleSimulateDowngrade}
              className="border border-yellow-900/40 text-yellow-700 text-xs font-mono py-1.5 rounded-lg hover:bg-yellow-950/30 transition-colors w-full mb-3"
            >
              Simulate downgrade (dev only)
            </button>
          )}

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full border border-red-900/40 text-red-700 text-sm font-mono py-2.5 rounded-xl hover:bg-red-950/20 hover:border-red-800/50 transition-colors"
            >
              Delete account
            </button>
          ) : (
            <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-4 space-y-3">
              <p className="text-red-400 text-xs font-mono">
                This permanently deletes your account and all data. Cannot be undone.
              </p>
              {deleteError && (
                <div className="rounded-lg bg-red-950/20 border border-red-800/40 px-3 py-2">
                  <p className="text-red-400 text-xs font-mono">Failed to delete account. Try again or contact support.</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
                  disabled={deleting}
                  className="flex-1 bg-zinc-950 border border-zinc-700/40 text-zinc-500 text-xs font-mono py-2 rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 bg-red-900/40 border border-red-700/40 text-red-300 text-xs font-mono py-2 rounded-lg hover:bg-red-900/60 transition-colors disabled:opacity-40"
                >
                  {deleting ? 'Deleting...' : 'Confirm delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
