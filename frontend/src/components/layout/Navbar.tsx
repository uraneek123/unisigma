import { Moon, Sigma, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

type MainView = "landing" | "questions" | "upload"

type NavbarProps = {
  view: MainView
  onChangeView: (view: MainView) => void
}

export function Navbar({ view, onChangeView }: NavbarProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return true
    return document.documentElement.classList.contains("dark")
  })

  useEffect(() => {
    if (typeof document === "undefined") return
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4 sm:px-8 lg:px-12">
        {/* Logo */}
        <button
          type="button"
          onClick={() => onChangeView("landing")}
          className="flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Sigma className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col leading-tight text-left">
            <span className="text-lg font-semibold tracking-tight">
              uniSigma
            </span>
            <span className="text-xs text-muted-foreground">
              Collaborative math Q&amp;A
            </span>
          </div>
        </button>

        {/* Primary nav */}
        <nav className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-6 text-sm">
            <li>
              <button
                type="button"
                onClick={() => onChangeView("landing")}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"
                data-active={view === "landing"}
              >
                Home
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onChangeView("questions")}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"
                data-active={view === "questions"}
              >
                Questions
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onChangeView("upload")}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"
                data-active={view === "upload"}
              >
                Upload
              </button>
            </li>
            <li>
              <a
                href="#topics"
                className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                Topics
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                About
              </a>
            </li>
          </ul>
        </nav>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setIsDark((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-muted/60"
          >
            {isDark ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <Button
            variant="secondary"
            size="lg"
            className="hidden sm:inline-flex px-5 text-sm"
          >
            Login
          </Button>
          <Button size="lg" className="px-6 text-sm font-semibold shadow-md">
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}

