import { motion } from "motion/react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CreateProblemForm } from "./CreateProblemForm"
import { SourcesSection } from "./SourcesSection"
import { TagsSection } from "./TagsSection"

export function UploadView() {
  return (
    <motion.div
      className="mx-auto max-w-3xl space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border-dashed border-border/70 bg-card/60">
        <CardHeader className="text-center">
          <CardTitle className="font-heading">Upload & create</CardTitle>
          <CardDescription className="mx-auto max-w-md">
            Create problems and manage tags and sources. Use the optional
            image-to-LaTeX in the form to fill fields.
          </CardDescription>
        </CardHeader>
      </Card>
      <CreateProblemForm />
      <TagsSection />
      <SourcesSection />
    </motion.div>
  )
}
