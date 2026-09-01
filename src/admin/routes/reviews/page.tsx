import { defineRouteConfig } from "@medusajs/admin-sdk"
import { StarSolid } from "@medusajs/icons"
import { Button, Heading, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useCaAccessGuard } from "../../lib/ca-access"

type Review = {
  id: string
  product_id: string
  author_name: string
  author_email: string | null
  rating: number
  title: string | null
  body: string
  is_approved: boolean
  created_at: string
}

type Tab = "pending" | "approved" | "all"

const STARS = [1, 2, 3, 4, 5]

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {STARS.map((s) => (
        <span key={s} style={{ color: s <= rating ? "#FFB547" : "#444" }}>
          ★
        </span>
      ))}
    </span>
  )
}

const ReviewsPage = () => {
  useCaAccessGuard()

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("pending")
  const [actioning, setActioning] = useState<string | null>(null)

  const fetchReviews = (status: Tab) => {
    setLoading(true)
    fetch(`/admin/reviews?status=${status}`, { credentials: "include" })
      .then((r) => r.json())
      .then(({ reviews: data }) => setReviews(data ?? []))
      .catch(() => toast.error("Failed to load reviews"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReviews(tab)
  }, [tab])

  const approve = async (id: string) => {
    setActioning(id)
    try {
      const res = await fetch(`/admin/reviews/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_approved: true }),
      })
      if (!res.ok) throw new Error()
      setReviews((prev) =>
        tab === "pending" ? prev.filter((r) => r.id !== id) : prev.map((r) => (r.id === id ? { ...r, is_approved: true } : r))
      )
      toast.success("Review approved")
    } catch {
      toast.error("Failed to approve review")
    } finally {
      setActioning(null)
    }
  }

  const reject = async (id: string) => {
    setActioning(id)
    try {
      const res = await fetch(`/admin/reviews/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_approved: false }),
      })
      if (!res.ok) throw new Error()
      setReviews((prev) =>
        tab === "approved" ? prev.filter((r) => r.id !== id) : prev.map((r) => (r.id === id ? { ...r, is_approved: false } : r))
      )
      toast.success("Review unapproved")
    } catch {
      toast.error("Failed to update review")
    } finally {
      setActioning(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return
    setActioning(id)
    try {
      const res = await fetch(`/admin/reviews/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error()
      setReviews((prev) => prev.filter((r) => r.id !== id))
      toast.success("Review deleted")
    } catch {
      toast.error("Failed to delete review")
    } finally {
      setActioning(null)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "all", label: "All" },
  ]

  return (
    <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg p-6 flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Product Reviews</Heading>
          <p className="text-ui-fg-subtle text-sm mt-1">
            Approve customer reviews before they appear on the storefront.
          </p>
        </div>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                tab === t.id
                  ? "bg-ui-bg-interactive text-ui-fg-on-inverted border-ui-border-interactive"
                  : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-ui-fg-subtle text-sm">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-ui-fg-subtle text-sm">No {tab === "all" ? "" : tab} reviews.</p>
      ) : (
        <div className="flex flex-col gap-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded border border-ui-border-base p-4 flex flex-col gap-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-ui-fg-base text-sm font-medium">
                      {review.author_name}
                    </span>
                    {review.author_email && (
                      <span className="text-ui-fg-subtle text-xs">{review.author_email}</span>
                    )}
                    <StarRow rating={review.rating} />
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        review.is_approved
                          ? "text-green-600 border-green-300 bg-green-50"
                          : "text-yellow-600 border-yellow-300 bg-yellow-50"
                      }`}
                    >
                      {review.is_approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                  <span className="text-ui-fg-disabled text-[11px]">
                    {review.product_id} · {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!review.is_approved && (
                    <Button
                      size="small"
                      variant="primary"
                      onClick={() => approve(review.id)}
                      disabled={actioning === review.id}
                    >
                      Approve
                    </Button>
                  )}
                  {review.is_approved && (
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => reject(review.id)}
                      disabled={actioning === review.id}
                    >
                      Unapprove
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => remove(review.id)}
                    disabled={actioning === review.id}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {review.title && (
                <p className="text-ui-fg-base text-sm font-medium">"{review.title}"</p>
              )}
              <p className="text-ui-fg-subtle text-sm leading-relaxed">{review.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Reviews",
  icon: StarSolid,
})

export default ReviewsPage
