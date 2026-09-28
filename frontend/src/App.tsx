function App() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <section className="text-center text-white">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-purple-400">
          Music Royalty Audit
        </p>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          RoyaltyGuard
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Detect potential royalty leakage by comparing reported payouts
          against expected earnings from streaming activity.
        </p>
      </section>
    </main>
  )
}

export default App