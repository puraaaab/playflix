"use client";

import Link from 'next/link';

function Poster({ video }) {
  const gradient = video.is_premium
    ? 'from-[#e50914] via-[#7f1016] to-[#10131a]'
    : 'from-[#1f2937] via-[#0f1726] to-[#101521]';

  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br ${gradient} p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_25%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_42%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-white/75">
          <span>{video.genre}</span>
          <span>{video.maturity_rating}</span>
        </div>
        <div>
          <div className="heading-font text-2xl font-bold leading-tight text-white">{video.title}</div>
          <p className="mt-2 line-clamp-3 text-sm text-white/72">{video.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function VideoShelf({ title, videos, actions, onToggleAction }) {
  const watchlistSet = actions?.watchlist || new Set();
  const favoriteSet = actions?.favorites || new Set();
  const reactions = actions?.reactions || {};

  const toggle = (videoId, action, currentlyActive) => {
    if (!onToggleAction) {
      return;
    }
    onToggleAction(videoId, action, !currentlyActive);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="heading-font text-2xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/55">Trending now in a Netflix-style row.</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video) => (
          <article key={video.id} className="group w-[220px] shrink-0 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] sm:w-[250px]">
            <Poster video={video} />
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{video.title}</h3>
                <p className="mt-1 text-sm text-white/56">{video.description}</p>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white/55">
                {video.is_premium ? 'Premium' : 'Included'}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href={`/watch/${video.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Watch
              </Link>
              <span className="text-sm text-white/50">{video.genre}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => toggle(video.id, 'watchlist', watchlistSet.has(video.id))}
                className={`rounded-full border px-3 py-1.5 transition ${watchlistSet.has(video.id) ? 'border-[#e50914]/60 bg-[#e50914]/20 text-white' : 'border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]'}`}
              >
                {watchlistSet.has(video.id) ? 'In Watchlist' : 'Watchlist'}
              </button>
              <button
                type="button"
                onClick={() => toggle(video.id, 'favorite', favoriteSet.has(video.id))}
                className={`rounded-full border px-3 py-1.5 transition ${favoriteSet.has(video.id) ? 'border-[#e50914]/60 bg-[#e50914]/20 text-white' : 'border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]'}`}
              >
                {favoriteSet.has(video.id) ? 'Favorited' : 'Favorite'}
              </button>
              <button
                type="button"
                onClick={() => toggle(video.id, 'like', reactions[String(video.id)] === 'like')}
                className={`rounded-full border px-3 py-1.5 transition ${reactions[String(video.id)] === 'like' ? 'border-[#e50914]/60 bg-[#e50914]/20 text-white' : 'border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]'}`}
              >
                Like
              </button>
              <button
                type="button"
                onClick={() => toggle(video.id, 'dislike', reactions[String(video.id)] === 'dislike')}
                className={`rounded-full border px-3 py-1.5 transition ${reactions[String(video.id)] === 'dislike' ? 'border-[#e50914]/60 bg-[#e50914]/20 text-white' : 'border-white/15 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]'}`}
              >
                Dislike
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
