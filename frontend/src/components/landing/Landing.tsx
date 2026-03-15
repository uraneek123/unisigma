import { ArrowRight, Database, Sigma } from "lucide-react"
import { motion } from "motion/react"

import { Button } from "../ui/button"
import UnicornTitle from "../unicornbs/thing"

const easeOutCubic = [0.25, 0.46, 0.45, 0.94] as const

const container = {
  hidden: { opacity: 0 },
  visible: (i = 1) => ({
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 * i },
  }),
}

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutCubic },
  },
}

type LandingProps = {
  onGetStarted: () => void
}

export function Landing({ onGetStarted }: LandingProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-b from-background/90 via-background/70 to-background">
      {/* Unicorn scene as full-bleed background, fully visible, lowered by 20% */}
      <div
        className="pointer-events-none absolute left-0 right-0 h-[100%] w-full"
        aria-hidden="true"
      >
        <UnicornTitle width="100%" height="100%" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-1 flex-col px-6 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <section className="relative flex min-h-[calc(100vh-8rem)] flex-col">
          <motion.div
            className="relative mt-auto max-w-3xl pb-16 pl-0 pr-2 sm:pb-20 sm:pr-4 lg:pb-24 lg:pr-6"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={item}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-widest text-primary backdrop-blur-md"
            >
              <Database className="h-3 w-3" aria-hidden="true" />
              <span>Math Q&amp;A</span>
            </motion.div>
            <h1 className="font-display mt-8 text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl [font-family:var(--font-display)]">
              <motion.span variants={item} className="block text-foreground">
                Search.
              </motion.span>
              <motion.span variants={item} className="block text-foreground">
                Browse.
              </motion.span>
              <motion.span variants={item} className="block text-primary">
                Contribute.
              </motion.span>
            </h1>
            <motion.p
              variants={item}
              className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base"
            >
              Math questions by topic and difficulty. LaTeX-native.
            </motion.p>
            <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="group rounded-full px-8 py-6 text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25"
                onClick={onGetStarted}
              >
                Browse
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Button>
            </motion.div>
          </motion.div>
        </section>
      </div>

      <footer className="relative border-t border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sigma className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <span className="font-display text-sm font-semibold tracking-tight [font-family:var(--font-display)]">
                uniSigma
              </span>
              <span className="block text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Math Q&amp;A
              </span>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <a
              href="#topics"
              className="transition-colors hover:text-foreground"
            >
              Topics
            </a>
            <a
              href="#about"
              className="transition-colors hover:text-foreground"
            >
              About
            </a>
          </nav>
          <p className="text-[0.7rem] uppercase tracking-widest text-muted-foreground/80">
            © {new Date().getFullYear()} uniSigma
          </p>
        </div>
      </footer>
    </main>
  )
}

