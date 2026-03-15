import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"

const easeOutCubic = [0.25, 0.46, 0.45, 0.94] as const

export function AboutPage() {
  return (
    <motion.main
      className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col items-center justify-center px-4 py-12"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: easeOutCubic }}
    >
      <Card className="border-border/60 bg-card/80 shadow-sm">
        <CardContent className="py-8 px-8">
          <p className="text-center font-heading text-lg text-foreground sm:text-xl">
            Created by 6 clueless UNSW students
          </p>
        </CardContent>
      </Card>
    </motion.main>
  )
}
