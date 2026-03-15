import { Search } from "lucide-react"
import { motion } from "motion/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { SourceRead, TagRead } from "@/types/api"

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_at_desc", label: "Newest" },
  { value: "created_at_asc", label: "Oldest" },
  { value: "tag_asc", label: "Tag A–Z" },
  { value: "tag_desc", label: "Tag Z–A" },
  { value: "source_asc", label: "Source A–Z" },
  { value: "source_desc", label: "Source Z–A" },
]

const ALL_VALUE = "__all__"

type FilterBarProps = {
  search: string
  selectedTagId: number | null
  selectedSourceId: number | null
  sort: string
  tags: TagRead[]
  sources: SourceRead[]
  onSearchChange: (value: string) => void
  onTagChange: (tagId: number | null) => void
  onSourceChange: (sourceId: number | null) => void
  onSortChange: (value: string) => void
}

export function FilterBar({
  search,
  selectedTagId,
  selectedSourceId,
  sort,
  tags,
  sources,
  onSearchChange,
  onTagChange,
  onSourceChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <motion.div
      aria-label="Search and filter questions"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="border-border/60 bg-card/70 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Search className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="font-heading text-base leading-tight sm:text-lg">
                Find a math question
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Filter by tag, source, and search text to discover problems to solve.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative min-w-0 flex-1 space-y-2">
              <Label htmlFor="filter-search" className="sr-only">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="filter-search"
                  type="search"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search by keyword, LaTeX, or title…"
                  className="h-10 pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="min-w-0 flex-1 space-y-2 md:w-40">
                <Label htmlFor="filter-tag" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tag
                </Label>
                <Select
                  value={selectedTagId != null ? String(selectedTagId) : ALL_VALUE}
                  onValueChange={(v) => onTagChange(v === ALL_VALUE ? null : Number(v))}
                >
                  <SelectTrigger id="filter-tag" className="h-10 w-full capitalize">
                    <SelectValue placeholder="All tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All tags</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={String(tag.id)} className="capitalize">
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 flex-1 space-y-2 md:w-40">
                <Label htmlFor="filter-source" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Source
                </Label>
                <Select
                  value={selectedSourceId != null ? String(selectedSourceId) : ALL_VALUE}
                  onValueChange={(v) => onSourceChange(v === ALL_VALUE ? null : Number(v))}
                >
                  <SelectTrigger id="filter-source" className="h-10 w-full">
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All sources</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={String(source.id)}>
                        {source.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 flex-1 space-y-2 md:w-36">
                <Label htmlFor="filter-sort" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sort
                </Label>
                <Select value={sort} onValueChange={onSortChange}>
                  <SelectTrigger id="filter-sort" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
