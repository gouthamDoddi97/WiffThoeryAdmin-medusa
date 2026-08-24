/** GST state / UT codes (place of supply). */
export const GST_STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "jammu & kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  orissa: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "dadra and nagar haveli and daman and diu": "26",
  maharashtra: "27",
  "andhra pradesh": "37",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  ladakh: "38",
}

const PINCODE_STATE_PREFIX: Record<string, string> = {
  "11": "07",
  "12": "06",
  "13": "06",
  "14": "03",
  "15": "03",
  "16": "03",
  "17": "03",
  "18": "03",
  "19": "03",
  "20": "09",
  "21": "09",
  "22": "09",
  "23": "09",
  "24": "09",
  "25": "09",
  "26": "09",
  "27": "09",
  "28": "09",
  "30": "09",
  "31": "09",
  "32": "09",
  "33": "09",
  "34": "09",
  "36": "10",
  "38": "09",
  "39": "09",
  "40": "27",
  "41": "27",
  "42": "27",
  "43": "27",
  "44": "27",
  "45": "27",
  "46": "27",
  "47": "27",
  "48": "27",
  "49": "27",
  "50": "36",
  "51": "36",
  "52": "36",
  "53": "36",
  "56": "29",
  "57": "29",
  "58": "29",
  "59": "29",
  "60": "33",
  "61": "33",
  "62": "33",
  "63": "33",
  "64": "33",
  "67": "33",
  "68": "33",
  "69": "33",
  "70": "19",
  "71": "19",
  "72": "19",
  "73": "19",
  "74": "19",
  "75": "21",
  "76": "21",
  "77": "21",
  "78": "18",
  "79": "18",
  "80": "10",
  "81": "10",
  "82": "10",
  "83": "10",
  "84": "10",
  "85": "10",
  "86": "10",
  "87": "10",
  "88": "10",
  "90": "32",
  "91": "32",
  "92": "32",
  "93": "32",
  "94": "32",
  "95": "32",
  "96": "32",
  "97": "32",
  "98": "32",
  "99": "32",
}

export function supplierStateFromGstin(gstin: string): string {
  const code = gstin.trim().slice(0, 2)
  return /^\d{2}$/.test(code) ? code : "37"
}

export function resolvePlaceOfSupply(input: {
  province?: string | null
  postalCode?: string | null
  countryCode?: string | null
  fallbackStateCode: string
}): string {
  if (input.countryCode && input.countryCode.toLowerCase() !== "in") {
    return "96"
  }

  const province = input.province?.trim().toLowerCase()
  if (province && GST_STATE_CODES[province]) {
    return GST_STATE_CODES[province]
  }

  const pin = input.postalCode?.replace(/\D/g, "").slice(0, 2)
  if (pin && PINCODE_STATE_PREFIX[pin]) {
    return PINCODE_STATE_PREFIX[pin]
  }

  return input.fallbackStateCode
}
