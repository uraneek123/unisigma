import { Sigma } from "lucide-react"
import { motion } from "motion/react"
import { useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"
import { Button } from "../ui/button"
import { Separator } from "../ui/separator"

type MainView = "landing" | "questions" | "upload" | "about"

type NavbarProps = {
  view: MainView
  onChangeView: (view: MainView) => void
}

const navItem = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
}

export function Navbar({ view, onChangeView }: NavbarProps) {
  const { isLoggedIn, account, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectSearch =
    location.pathname !== "/" || location.search
      ? `?redirect=${encodeURIComponent(location.pathname + location.search)}`
      : ""

  return (
    <motion.header
      className="border-b border-border/60 bg-background/95 backdrop-blur-xl"
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8 sm:py-4 lg:px-12">
        <motion.button
          type="button"
          onClick={() => (location.pathname === "/about" ? navigate("/") : onChangeView("landing"))}
          className="flex items-center gap-3"
          variants={navItem}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Sigma className="h-5 w-5" aria-hidden="true" />
          </motion.div>
          <div className="flex flex-col leading-tight text-left">
            <span className="font-heading text-base tracking-tight sm:text-lg">
              uniSigma
            </span>
            <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground sm:text-xs">
              Math Q&amp;A
            </span>
          </div>
        </motion.button>

        <nav className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-6 text-sm">
            {[
              { id: "landing", label: "Home" },
              { id: "questions", label: "Questions" },
              { id: "upload", label: "Upload" },
            ].map(({ id, label }) => (
              <li key={id}>
                <motion.button
                  type="button"
                  onClick={() =>
                    location.pathname === "/about"
                      ? navigate("/", { state: { view: id } })
                      : onChangeView(id as MainView)
                  }
                  className="text-[0.8125rem] font-medium text-foreground/75 transition-colors hover:text-foreground data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4 data-[active=true]:decoration-2"
                  data-active={view === id}
                  variants={navItem}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {label}
                </motion.button>
              </li>
            ))}
            <li>
              <motion.button
                type="button"
                onClick={() => navigate("/about")}
                className="text-[0.8125rem] font-medium text-foreground/75 transition-colors hover:text-foreground data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4 data-[active=true]:decoration-2"
                data-active={view === "about"}
                variants={navItem}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                About
              </motion.button>
            </li>
          </ul>
        </nav>

        <Separator orientation="vertical" className="hidden h-6 md:block" />

        <div className="ml-auto flex items-center gap-3">
          {isLoggedIn && account ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {account.username}
              </span>
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => logout()}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="lg"
                className="hidden rounded-full text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
                onClick={() => navigate(`/login${redirectSearch}`)}
              >
                Login
              </Button>
              <Button
                size="lg"
                className="rounded-full px-6 text-sm font-semibold shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20"
                onClick={() => navigate(`/signup${redirectSearch}`)}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  )
}

