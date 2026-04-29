"use client";

import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api.js';
import VideoShelf from '../../components/VideoShelf.js';

export default function BrowsePage() {
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [reactions, setReactions] = useState({});

  useEffect(() => {
    let mounted = true;

    async function loadBrowseData() {
      try {
        const [catalogResponse, meResponse, watchlistResponse, favoritesResponse, reactionsResponse] = await Promise.allSettled([
          api.get('/api/videos/catalog'),
          api.get('/api/auth/me'),
          api.get('/api/videos/my/watchlist'),
          api.get('/api/videos/my/favorites'),
          api.get('/api/videos/my/reactions')
        ]);

        if (!mounted) {
          return;
        }

        if (catalogResponse.status === 'fulfilled') {
          setVideos(catalogResponse.value.data.videos || []);
        }

        if (meResponse.status === 'fulfilled') {
          setUser(meResponse.value.data.user || null);
        }

        if (watchlistResponse.status === 'fulfilled') {
          setWatchlist(new Set((watchlistResponse.value.data.videos || []).map((item) => item.id)));
        }

        if (favoritesResponse.status === 'fulfilled') {
          setFavorites(new Set((favoritesResponse.value.data.videos || []).map((item) => item.id)));
        }

        if (reactionsResponse.status === 'fulfilled') {
          setReactions(reactionsResponse.value.data.reactions || {});
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError?.response?.data?.message || 'Unable to load the catalog.');
        }
      }
    }

    loadBrowseData();
    return () => {
      mounted = false;
    };
  }, []);

  const sections = useMemo(() => {
    const grouped = new Map();
    for (const video of videos) {
      const key = video.genre || 'Featured';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(video);
    }
    return Array.from(grouped.entries()).map(([genre, genreVideos]) => ({ genre, genreVideos }));
  }, [videos]);

  const featured = videos[0];
  const spotlight = videos.slice(1, 5);

  async function refreshMemberActions() {
    const [watchlistResponse, favoritesResponse, reactionsResponse] = await Promise.all([
      api.get('/api/videos/my/watchlist'),
      api.get('/api/videos/my/favorites'),
      api.get('/api/videos/my/reactions')
    ]);

    setWatchlist(new Set((watchlistResponse.data.videos || []).map((item) => item.id)));
    setFavorites(new Set((favoritesResponse.data.videos || []).map((item) => item.id)));
    setReactions(reactionsResponse.data.reactions || {});
  }

  async function handleToggleAction(videoId, action, active) {
    try {
      await api.post('/api/videos/action', { videoId, action, active });
      await refreshMemberActions();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not update your list action.');
    }
  }

  return (
    <div className="playflix-shell py-6 md:py-10">
      <div className="overflow-hidden rounded-[40px] border border-white/10 bg-[#0a0a0d]">
        <div className="grid gap-8 p-6 md:p-10 xl:grid-cols-[1.1fr_0.9fr] xl:p-12">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/55">Browse</div>
            <h1 className="heading-font max-w-3xl text-4xl font-black leading-[0.98] text-white md:text-6xl">
              {user ? `${user.name}, continue the binge.` : 'Stream the best films, series, and originals.'}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/66">
              {user ? `Your ${user.subscriptionPlan} membership is ready for movie night.` : 'Sign in to save titles, continue watching, and unlock premium playback.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {['Trending', 'New Releases', 'Originals', 'Action', 'Drama', 'Comedy'].map((chip) => (
                <span key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span>Featured today</span>
              <span className="rounded-full bg-[#e50914] px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white">Play now</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.28),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.18))] p-5">
              <div className="flex min-h-[320px] flex-col justify-between">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/60">
                  <span>{featured?.genre || 'Featured'}</span>
                  <span>{featured?.maturity_rating || '13+'}</span>
                </div>
                <div>
                  <div className="heading-font text-3xl font-bold text-white">{featured?.title || 'Midnight Circuit'}</div>
                  <p className="mt-2 max-w-md text-sm leading-7 text-white/72">
                    {featured?.description || 'A glossy, high-stakes thriller with a cinematic poster-first presentation.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2">Movie night</span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2">Trending now</span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2">Continue watching</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/68">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/45">Plan</div>
                <div className="mt-1 font-semibold text-white">{user?.subscriptionPlan || 'Free'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/45">Access</div>
                <div className="mt-1 font-semibold text-white">{user?.subscriptionStatus || 'Browse'}</div>
              </div>
            </div>
          </div>
        </div>

        {error ? <div className="mx-6 mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100 md:mx-10">{error}</div> : null}
      </div>

      <div className="mt-8 space-y-10">
        {spotlight.length ? <VideoShelf title="Spotlight" videos={spotlight} actions={{ watchlist, favorites, reactions }} onToggleAction={handleToggleAction} /> : null}
        {sections.map((section) => (
          <VideoShelf key={section.genre} title={section.genre} videos={section.genreVideos} actions={{ watchlist, favorites, reactions }} onToggleAction={handleToggleAction} />
        ))}
      </div>
    </div>
  );
}
