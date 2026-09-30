interface SectionPageProps {
  title: string
  eyebrow: string
  description?: string
}

function SectionPage({ title, eyebrow, description }: SectionPageProps) {
  return (
    <section className="page-enter max-w-5xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px w-7 bg-signal" />
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-pine">{eyebrow}</p>
      </div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
        {title}
      </h1>
      {description && <p className="mt-4 max-w-xl text-base leading-7 text-muted">{description}</p>}
      <div aria-hidden="true" className="mt-10 h-px max-w-2xl bg-line" />
    </section>
  )
}

export default SectionPage