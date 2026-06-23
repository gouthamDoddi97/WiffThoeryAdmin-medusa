import { Label } from "@medusajs/ui"
import { BUDGET_ATTACHMENT_ACCEPT, isImageAttachment } from "./upload"

export function AttachmentField({
  label,
  hint,
  url,
  uploading,
  required,
  readOnly,
  onUpload,
  onClear,
}: {
  label: string
  hint?: string
  url?: string | null
  uploading?: boolean
  required?: boolean
  readOnly?: boolean
  onUpload: (file: File) => void
  onClear?: () => void
}) {
  const inputId = `attachment-${label.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <div className="flex flex-col gap-2 border border-ui-border-base rounded-md p-3 bg-ui-bg-base">
      <Label htmlFor={inputId} className="text-xs">
        {label}
        {required ? " (required)" : " (optional)"}
      </Label>
      {hint && <p className="text-xs text-ui-fg-subtle">{hint}</p>}

      {url ? (
        <div className="flex flex-wrap items-center gap-3">
          {isImageAttachment(url) ? (
            <a href={url} target="_blank" rel="noreferrer" className="block">
              <img
                src={url}
                alt={label}
                className="max-h-32 rounded-md border border-ui-border-base object-contain"
              />
            </a>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ui-fg-interactive hover:underline"
            >
              View attachment
            </a>
          )}
          {!readOnly && onClear && (
            <button
              type="button"
              className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
              onClick={onClear}
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        !readOnly && (
          <p className="text-xs text-ui-fg-subtle">No file attached yet.</p>
        )
      )}

      {!readOnly && (
        <>
          <input
            id={inputId}
            type="file"
            accept={BUDGET_ATTACHMENT_ACCEPT}
            disabled={uploading}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ui-bg-subtle file:px-3 file:py-1.5"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ""
            }}
          />
          <p className="text-xs text-ui-fg-subtle">JPEG, PNG, WebP, GIF, or PDF</p>
        </>
      )}
    </div>
  )
}
