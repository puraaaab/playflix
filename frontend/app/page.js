import Link from 'next/link';

const heroTags = ['4K UHD', 'Dolby Audio', 'New Season', 'Top 10'];

const featuredRows = [
  {
    title: 'Continue Watching',
    items: [
      { title: 'Midnight Circuit', meta: 'Thriller · 2h 08m' },
      { title: 'Glass Harbor', meta: 'Drama · 1h 52m' },
      { title: 'Neon Atlas', meta: 'Sci-Fi · 2h 24m' },
      { title: 'Sunday Static', meta: 'Comedy · 1h 41m' }
    ]
  },
  {
    title: 'Top Picks For You',
    items: [
      { title: 'After Dark', meta: 'Action' },
      { title: 'Blue Hour', meta: 'Crime' },
      { title: 'Signal Lost', meta: 'Mystery' },
      { title: 'Coastal City', meta: 'Drama' }
    ]
  }
];

const topTen = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
];

function Tile({ title, meta, rank }) {
  return (
    <article className="group relative w-[170px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] sm:w-[190px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(229,9,20,0.18),transparent_30%)] opacity-0 transition duration-300 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col justify-between gap-10">
        <div className="flex items-start justify-between">
          <div className="text-5xl font-black leading-none text-white/15 sm:text-6xl">{rank}</div>
          <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] uppercase tracking-[0.35em] text-white/60">
            Play
          </div>
        </div>
        <div>
          <div className="heading-font text-lg font-bold text-white sm:text-xl">{title}</div>
          <div className="mt-1 text-sm text-white/55">{meta}</div>
        </div>
      </div>
    </article>
  );
}

function Row({ title, items, topTenMode = false }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="heading-font text-2xl font-bold text-white md:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-white/55">Press play on something great.</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topTenMode
          ? items.map((item, index) => <Tile key={item.title} rank={topTen[index] || String(index + 1)} title={item.title} meta={item.meta} />)
          : items.map((item) => (
              <article key={item.title} className="group w-[240px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] transition duration-300 hover:-translate-y-1 hover:border-white/20 sm:w-[270px]">
                <div className="aspect-[16/10] bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.24),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                <div className="p-4">
                  <div className="heading-font text-xl font-bold text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-white/58">{item.meta}</div>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="playflix-shell py-6 md:py-10">
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0a0a0d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(229,9,20,0.25),transparent_24%),radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.58))]" />
        <div className="relative grid gap-8 p-6 md:p-10 xl:grid-cols-[1.08fr_0.92fr] xl:p-12">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {heroTags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/60">
                  {tag}
                </span>
              ))}
            </div>
            <div className="max-w-3xl space-y-4">
              <h1 className="heading-font text-5xl font-black leading-[0.92] text-white md:text-7xl xl:text-[5.8rem]">
                The biggest hits, originals, and live moments in one place.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/68 md:text-xl">
                PlayFlix is styled like a premium streaming service with a rich hero banner, stacked carousels, and a membership flow powered by Razorpay.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/browse" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Play Now
              </Link>
              <Link href="/plans" className="rounded-full border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Join Membership
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
              <span>Action-packed premieres</span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
              <span>Watch on any screen</span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
              <span>New titles every week</span>
            </div>
          </div>

          <div className="relative rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-0 rounded-[34px] bg-[radial-gradient(circle_at_top_right,rgba(229,9,20,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
            <div className="relative flex items-center justify-between text-sm text-white/60">
              <span>Featured tonight</span>
              <span className="rounded-full bg-[#e50914] px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white">Top 10</span>
            </div>
            <div className="relative mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,18,0.2),rgba(15,15,18,0.7))] p-5">
              <div className="aspect-[16/10] rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.32),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.15))] p-5">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/60">
                    <span>PlayFlix Original</span>
                    <span>Now Streaming</span>
                  </div>
                  <div>
                    <div className="heading-font text-3xl font-bold text-white">Night Protocol</div>
                    <p className="mt-2 max-w-sm text-sm leading-7 text-white/72">
                      A high-stakes thriller with a cinematic binge-worthy look and an immersive story-first layout.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-white/72">
                {[
                  ['HD', '4K Ready'],
                  ['Audio', 'Dolby'],
                  ['Mood', 'Thriller']
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-white/45">{label}</div>
                    <div className="mt-1 font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          ['Trending', 'Big poster cards, strong contrast, and fast discovery like the major OTT apps.'],
          ['Membership', 'Razorpay checkout for a clean subscription flow without exposing secrets in the browser.'],
          ['Profiles', 'Save favourites, resume playback, and keep the experience focused on content.']
        ].map(([title, description]) => (
          <article key={title} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <div className="heading-font text-2xl font-bold text-white">{title}</div>
            <p className="mt-3 text-sm leading-7 text-white/64">{description}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 space-y-10">
        <Row title="Continue Watching" items={featuredRows[0].items} />
        <Row title="Top 10 in PlayFlix" items={featuredRows[1].items} topTenMode />
      </div>
    </div>
  );
}
