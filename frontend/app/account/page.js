"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api.js';

function SectionCard({ title, children, subtitle }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
      <h2 className="heading-font text-2xl font-bold text-white">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-white/60">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    setError('');
    try {
      const [accountResp, historyResp, watchlistResp, favoritesResp] = await Promise.all([
        api.get('/api/auth/account'),
        api.get('/api/videos/my/history'),
        api.get('/api/videos/my/watchlist'),
        api.get('/api/videos/my/favorites')
      ]);

      setAccount(accountResp.data);
      setHistory(historyResp.data.videos || []);
      setWatchlist(watchlistResp.data.videos || []);
      setFavorites(favoritesResp.data.videos || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load account details.');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function cancelSubscription() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/payments/cancel', {});
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not cancel subscription.');
    } finally {
      setBusy(false);
    }
  }

  const user = account?.user;

  return (
    <div className="playflix-shell py-8 md:py-12">
      <div className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 md:p-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/55">Account</div>
            <h1 className="heading-font mt-4 text-4xl font-bold text-white md:text-5xl">Your PlayFlix profile</h1>
            <p className="mt-3 text-sm text-white/65">Manage membership, view watch activity, and control your personal lists.</p>
          </div>
          <Link href="/plans" className="rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
            Change plan
          </Link>
        </div>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Member details" subtitle="Identity and active plan details.">
          <div className="space-y-3 text-sm text-white/80">
            <div><span className="text-white/50">Name:</span> {user?.name || '-'}</div>
            <div><span className="text-white/50">Email:</span> {user?.email || '-'}</div>
            <div><span className="text-white/50">Plan:</span> {user?.subscriptionPlan || 'free'}</div>
            <div><span className="text-white/50">Status:</span> {user?.subscriptionStatus || 'inactive'}</div>
            <div><span className="text-white/50">Days left:</span> {user?.subscriptionDaysLeft ?? 0}</div>
            <div><span className="text-white/50">Expires at:</span> {user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleString() : 'Not active'}</div>
          </div>
          <button
            type="button"
            disabled={busy || !user || user.subscriptionStatus !== 'active'}
            onClick={cancelSubscription}
            className="mt-5 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Cancelling...' : 'Cancel subscription'}
          </button>
        </SectionCard>

        <SectionCard title="Activity summary" subtitle="Your streaming footprint.">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Watched titles', account?.stats?.watchedCount || 0],
              ['Watchlist items', account?.stats?.watchlistCount || 0],
              ['Favorites', account?.stats?.favoriteCount || 0],
              ['Likes', account?.stats?.likeCount || 0],
              ['Dislikes', account?.stats?.dislikeCount || 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/45">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Continue watching" subtitle="Recent watch history.">
          <div className="space-y-3">
            {history.length === 0 ? <div className="text-sm text-white/55">No history yet.</div> : null}
            {history.slice(0, 8).map((item) => (
              <Link key={item.id} href={`/watch/${item.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-1 text-xs text-white/55">Last position: {item.last_position_seconds || 0}s</div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Watchlist and favorites" subtitle="Your saved picks.">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/45">Watchlist</div>
              <div className="space-y-2">
                {watchlist.length === 0 ? <div className="text-sm text-white/55">No watchlist items.</div> : null}
                {watchlist.slice(0, 6).map((item) => (
                  <Link key={`w-${item.id}`} href={`/watch/${item.id}`} className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition hover:bg-white/[0.06]">
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/45">Favorites</div>
              <div className="space-y-2">
                {favorites.length === 0 ? <div className="text-sm text-white/55">No favorites yet.</div> : null}
                {favorites.slice(0, 6).map((item) => (
                  <Link key={`f-${item.id}`} href={`/watch/${item.id}`} className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition hover:bg-white/[0.06]">
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
