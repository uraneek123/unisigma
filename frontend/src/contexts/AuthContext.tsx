import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AccountRead } from "@/types/api"
import * as api from "@/api/client"

const STORAGE_KEY = "unisigma_account"

type AuthContextValue = {
  account: AccountRead | null
  accountId: number | null
  isLoggedIn: boolean
  login: (account: AccountRead) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredAccount(): AccountRead | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as AccountRead
    if (data?.id != null && typeof data.id === "number") return data
  } catch {
    // ignore
  }
  return null
}

function saveAccount(account: AccountRead | null): void {
  if (account == null) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<AccountRead | null>(() => loadStoredAccount())

  useEffect(() => {
    if (account != null) {
      api.setActorUserId(account.id)
      saveAccount(account)
    } else {
      api.setActorUserId(null)
      saveAccount(null)
    }
  }, [account])

  const login = useCallback((next: AccountRead) => {
    setAccountState(next)
  }, [])

  const logout = useCallback(() => {
    setAccountState(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      accountId: account?.id ?? null,
      isLoggedIn: account != null,
      login,
      logout,
    }),
    [account, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx == null) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
