import { ArrowRight, Sigma } from "lucide-react"

import { Button } from "@/components/ui/button"

type LandingProps = {
  onGetStarted: () => void
}

export function Landing({ onGetStarted }: LandingProps) {
  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-background/80 to-background">
      {/* Unicorn.studio interactive background lives behind everything in this layout */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        data-role="unicorn-studio-background"
      />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-1 flex-col px-6 pb-16 pt-24 sm:px-8 lg:px-12">
        <section className="relative flex h-full flex-col">
          <div className="pointer-events-none absolute inset-4 rounded-3xl border border-primary/10 bg-gradient-to-tr from-primary/10 via-primary/0 to-foreground/5 blur-3xl" />

          {/* Hero content anchored toward lower-left with generous whitespace */}
          <div className="relative mt-auto max-w-3xl pb-12 pl-1 pr-4 sm:pb-16 sm:pl-3 sm:pr-8 lg:pb-20 lg:pl-4 lg:pr-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur">
              <Sigma className="h-4 w-4" aria-hidden="true" />
              <span>uniSigma · Math-native Q&amp;A</span>
            </div>
            <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
              <span className="block text-muted-foreground">
                All your math, one canvas.
              </span>
              <span className="mt-2 block text-primary">
                uniSigma is where every problem finds its proof.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-balance text-sm text-muted-foreground sm:text-base lg:text-lg">
              Ask questions, refine LaTeX, and soon upload entire documents for
              translation. uniSigma keeps your problem sets, solutions, and
              notation in a single rigorous, LaTeX-first flow.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button size="lg" className="px-7 text-sm md:text-base" onClick={onGetStarted}>
                Try it out
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="px-6 text-sm md:text-base"
                asChild
              >
                <a href="#features">Explore the features</a>
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:text-sm">
              <span>Dark-mode native · LaTeX-aware UX</span>
              <span className="hidden h-1 w-1 rounded-full bg-muted md:inline-block" />
              <span className="hidden md:inline">
                Built with a modern React + Tailwind stack
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Features marquee section */}
      <section
        id="features"
        className="border-t border-border/60 bg-card/80 py-7 text-xs text-muted-foreground backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Key capabilities
            </p>
            <p className="hidden text-[0.75rem] text-muted-foreground/80 sm:inline">
              Continuously streaming features · built for deep problem solving
            </p>
          </div>

          <div className="space-y-3 overflow-hidden">
            <div className="relative flex overflow-hidden rounded-xl border border-border/60 bg-background/70 py-3">
              <div className="marquee gap-3 px-3">
                {[
                  "LaTeX-first question and answer threads",
                  "Request precise edits to existing LaTeX",
                  "Upload documents for future LaTeX translation",
                  "Topic and difficulty-aware discovery",
                  "Fluid layout from mobile to ultra-wide desktop",
                ]
                  .concat([
                    "LaTeX-first question and answer threads",
                    "Request precise edits to existing LaTeX",
                    "Upload documents for future LaTeX translation",
                    "Topic and difficulty-aware discovery",
                    "Fluid layout from mobile to ultra-wide desktop",
                  ])
                  .map((feature, index) => (
                    <div
                      key={`${feature}-${index}`}
                      className="inline-flex min-w-[240px] items-center justify-center rounded-lg border border-border/50 bg-card/90 px-4 py-2 text-[0.8rem] text-foreground shadow-xs"
                    >
                      {feature}
                    </div>
                  ))}
              </div>
            </div>

            <div className="relative flex overflow-hidden rounded-xl border border-border/60 bg-background/70 py-3">
              <div className="marquee marquee-reverse gap-3 px-3">
                {[
                  "Unicorn.studio-ready interactive background layer",
                  "Keyboard-friendly, accessible controls",
                  "Future hooks for AI-assisted LaTeX cleanup",
                  "Designed for instructors, students, and researchers",
                ]
                  .concat([
                    "Unicorn.studio-ready interactive background layer",
                    "Keyboard-friendly, accessible controls",
                    "Future hooks for AI-assisted LaTeX cleanup",
                    "Designed for instructors, students, and researchers",
                  ])
                  .map((feature, index) => (
                    <div
                      key={`${feature}-${index}`}
                      className="inline-flex min-w-[240px] items-center justify-center rounded-lg border border-border/50 bg-card/90 px-4 py-2 text-[0.8rem] text-foreground shadow-xs"
                    >
                      {feature}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

