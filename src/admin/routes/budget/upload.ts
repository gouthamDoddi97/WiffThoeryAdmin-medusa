export const BUDGET_ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf"

export async function uploadBudgetAttachment(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("files", file)

  const res = await fetch("/admin/uploads", {
    method: "POST",
    credentials: "include",
    body: formData,
  })

  if (!res.ok) {
    throw new Error("Upload failed")
  }

  const { files } = await res.json()
  const url = files?.[0]?.url ?? files?.[0]?.file_url
  if (!url) {
    throw new Error("No upload URL returned")
  }

  return url as string
}

export function isImageAttachment(url: string) {
  return /\.(webp|jpe?g|png|gif)(\?|$)/i.test(url)
}
