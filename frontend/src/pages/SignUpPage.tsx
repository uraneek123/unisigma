import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCreateAccount } from "@/api/hooks"
import { useAuth } from "@/contexts/AuthContext"

function safeRedirect(redirect: string | null): string {
  if (!redirect || typeof redirect !== "string") return "/"
  const trimmed = redirect.trim()
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed
  return "/"
}

export function SignUpPage() {
  const { isLoggedIn, login } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const createAccountMutation = useCreateAccount()
  const redirectTo = safeRedirect(searchParams.get("redirect"))

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTo, { replace: true })
    }
  }, [isLoggedIn, navigate, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim()) {
      setError("Username is required.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    try {
      const account = await createAccountMutation.mutateAsync({
        username: username.trim(),
        password,
      })
      login(account)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.")
    }
  }

  if (isLoggedIn) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle id="signup-title" className="font-heading text-lg">
            Sign up
          </CardTitle>
          <CardDescription>
            Create an account to submit problems and answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="signup-username">Username</Label>
              <Input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Choose a username"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password (min 8 characters)</Label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Password"
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" className="w-full" disabled={createAccountMutation.isPending}>
                {createAccountMutation.isPending ? "Creating account…" : "Sign up"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link
                  to={redirectTo !== "/" ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/60 pt-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
