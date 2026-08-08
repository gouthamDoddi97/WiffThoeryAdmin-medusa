import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"

type PackingLabelMeta = {
  ready_at?: string
  order_barcode?: string
  awb?: string
}

const OrderPackingLabelWidget = ({ data: order }: { data: AdminOrder }) => {
  const [confirming, setConfirming] = useState(false)

  const packingLabel = useMemo(() => {
    const raw = (order.metadata as Record<string, unknown> | undefined)
      ?.packing_label
    return (raw ?? {}) as PackingLabelMeta
  }, [order.metadata])

  const shiprocket = useMemo(() => {
    return ((order.metadata as Record<string, unknown> | undefined)
      ?.shiprocket ?? {}) as { shipment_id?: number; awb?: string }
  }, [order.metadata])

  const isReady = Boolean(packingLabel.ready_at)
  const labelUrl = `/admin/orders/${order.id}/packing-label`
  const downloadUrl = `${labelUrl}?disposition=attachment`
  const shiprocketLabelUrl = `${labelUrl}?source=shiprocket`

  const openPrintDialog = () => {
    const popup = window.open(labelUrl, "_blank", "noopener,noreferrer")
    if (!popup) {
      toast.error("Allow pop-ups to print the label")
      return
    }
    popup.addEventListener("load", () => {
      popup.focus()
      popup.print()
    })
  }

  const confirmLabelApplied = async () => {
    setConfirming(true)
    try {
      const res = await fetch(`/admin/orders/${order.id}/packing-label/ack`, {
        method: "POST",
        credentials: "include",
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.message ?? "Could not confirm label")
      }
      toast.success("Packing label confirmed — you can create fulfillment now")
      window.location.reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Container className="p-0">
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Heading level="h2">Packing label</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Print your box sticker before fulfillment. Barcodes use{" "}
              <span className="font-mono">WT-#</span> (order) and AWB (courier).
            </Text>
          </div>
          <Badge color={isReady ? "green" : "orange"} size="2xsmall">
            {isReady ? "Ready to fulfill" : "Label required"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="primary" onClick={openPrintDialog}>
            Print label
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => window.open(downloadUrl, "_blank")}
          >
            Download PDF
          </Button>
          {shiprocket.shipment_id ? (
            <Button
              size="small"
              variant="secondary"
              onClick={() => window.open(shiprocketLabelUrl, "_blank")}
            >
              Shiprocket courier label
            </Button>
          ) : null}
        </div>

        {!isReady ? (
          <Button
            size="small"
            variant="secondary"
            isLoading={confirming}
            onClick={() => void confirmLabelApplied()}
          >
            Label printed & on box → enable fulfillment
          </Button>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Confirmed {packingLabel.ready_at ? new Date(packingLabel.ready_at).toLocaleString() : ""}
            {packingLabel.order_barcode ? ` · ${packingLabel.order_barcode}` : ""}
            {packingLabel.awb ? ` · AWB ${packingLabel.awb}` : ""}
          </Text>
        )}

        <Text size="xsmall" className="text-ui-fg-muted">
          Best practice: use Code128 on short IDs (not full product JSON). Order scan = warehouse lookup.
          AWB scan = courier tracking. Shiprocket&apos;s panel label customizer still applies to courier labels.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderPackingLabelWidget
