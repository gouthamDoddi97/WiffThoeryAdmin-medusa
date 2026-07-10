export type StockLocationAddressInput = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

/** Validates warehouse address for Shiprocket pickup sync. Returns error message or null. */
export function hasStreetNumber(
  address: StockLocationAddressInput | null | undefined
): boolean {
  if (!address) {
    return false
  }
  const combined = [address.address_1, address.address_2]
    .filter(Boolean)
    .join(" ")
  return /\d/.test(combined)
}

/** Shiprocket wants a numbered street line — combine lines if needed. */
export function primaryShiprocketAddress(
  address: StockLocationAddressInput
): string {
  const line1 = address.address_1?.trim() ?? ""
  const line2 = address.address_2?.trim()

  if (/\d/.test(line1)) {
    return line1.slice(0, 80)
  }

  if (line2 && /\d/.test(line2)) {
    return `${line2}, ${line1}`.slice(0, 80)
  }

  return `1, ${line1}`.slice(0, 80)
}

export function validateStockLocationAddress(
  address: StockLocationAddressInput | null | undefined
): string | null {
  if (!address) {
    return "Warehouse address is required (address, city, state, pincode, phone)."
  }

  if (!address.address_1?.trim()) {
    return "Address line 1 is required."
  }

  if (!hasStreetNumber(address)) {
    return "Add a house, flat, or road number in address line 1 or line 2 (required for Shiprocket)."
  }

  if (!address.city?.trim()) {
    return "City is required."
  }

  if (!address.province?.trim()) {
    return "State / province is required."
  }

  if (!address.postal_code?.trim()) {
    return "Postal code (pincode) is required."
  }

  if (!address.country_code?.trim()) {
    return "Country is required."
  }

  const phone = address.phone?.replace(/\D/g, "") ?? ""
  if (phone.length < 10) {
    return "Phone is required (10-digit number for Shiprocket pickup)."
  }

  return null
}
