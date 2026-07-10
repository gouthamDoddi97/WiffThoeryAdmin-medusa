import { Input, Label } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

type Suggestion = {
  id: string
  name: string
  display_name: string
  has_image: boolean
}

type NoteTagsInputProps = {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
}

export default function NoteTagsInput({
  id,
  label,
  hint,
  value,
  onChange,
}: NoteTagsInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeToken, setActiveToken] = useState("")
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = activeToken.trim()
    if (token.length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(() => {
      fetch(`/admin/fragrance-notes/suggest?q=${encodeURIComponent(token)}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then(({ suggestions: items }) => setSuggestions(items ?? []))
        .catch(() => setSuggestions([]))
    }, 200)

    return () => clearTimeout(timer)
  }, [activeToken])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    onChange(next)

    const parts = next.split(",")
    const tail = parts[parts.length - 1] ?? ""
    setActiveToken(tail)
    setOpen(tail.trim().length >= 2)
  }

  const applySuggestion = (displayName: string) => {
    const parts = value.split(",").map((p) => p.trim())
    parts.pop()
    const prefix = parts.filter(Boolean)
    const joined = [...prefix, displayName].join(", ")
    onChange(joined ? `${joined}, ` : `${displayName}, `)
    setOpen(false)
    setActiveToken("")
  }

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-y-1">
      <Label htmlFor={id} size="small">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={handleInput}
        onFocus={() => activeToken.trim().length >= 2 && setOpen(true)}
        placeholder="e.g. Saffron, Rose, Sandalwood"
      />
      {hint && <p className="text-ui-fg-muted text-xs">{hint}</p>}

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-ui-bg-subtle"
                onClick={() => applySuggestion(s.display_name)}
              >
                <span>{s.display_name}</span>
                <span
                  className={`text-[10px] uppercase tracking-wide ${
                    s.has_image ? "text-ui-fg-muted" : "text-ui-fg-interactive"
                  }`}
                >
                  {s.has_image ? "has image" : "needs image"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
