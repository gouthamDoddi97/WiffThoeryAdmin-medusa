import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

type Alerts = {
  total_count: number
  notes_pending_images: {
    count: number
    items: Array<{ id: string; name: string; display_name: string }>
  }
  warehouse_pending: {
    count: number
    items: Array<{
      location_id: string
      location_name: string
      issue: "invalid_address" | "not_synced"
      message: string
    }>
  }
}

const DashboardAlertsWidget = () => {
  const [alerts, setAlerts] = useState<Alerts | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  const load = () => {
    fetch("/admin/dashboard-alerts", { credentials: "include" })
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => setAlerts(null))
  }

  useEffect(() => {
    load()
  }, [])

  const syncWarehouse = async (locationId: string) => {
    setSyncing(locationId)
    try {
      const res = await fetch("/admin/shiprocket/sync-warehouse", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_location_id: locationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Sync failed")
      toast.success(data.message ?? "Warehouse synced")
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSyncing(null)
    }
  }

  if (!alerts?.total_count) return null

  return (
    <div className="mb-4 flex flex-col gap-2">
      {alerts.notes_pending_images.count > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2 text-sm">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-bg-interactive px-1.5 text-[11px] font-semibold text-ui-fg-on-color">
            {alerts.notes_pending_images.count}
          </span>
          <span className="text-ui-fg-base">
            fragrance note{alerts.notes_pending_images.count === 1 ? "" : "s"} need
            images
          </span>
          <Link
            to="/fragrance-notes"
            className="text-ui-fg-interactive underline underline-offset-2 text-xs ml-auto"
          >
            Manage notes →
          </Link>
        </div>
      )}

      {alerts.warehouse_pending.items.map((item) => (
        <div
          key={item.location_id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2 text-sm"
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-ui-tag-orange-icon" />
          <span className="text-ui-fg-base flex-1 min-w-0">
            <strong>{item.location_name}</strong>
            <span className="text-ui-fg-muted"> — {item.message}</span>
          </span>
          {item.issue === "not_synced" ? (
            <Button
              size="small"
              variant="secondary"
              isLoading={syncing === item.location_id}
              onClick={() => void syncWarehouse(item.location_id)}
            >
              Sync warehouse now
            </Button>
          ) : (
            <Link
              to="/settings/locations"
              className="text-ui-fg-interactive underline underline-offset-2 text-xs"
            >
              Fix address →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default DashboardAlertsWidget
