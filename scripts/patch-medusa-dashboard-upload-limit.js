const fs = require("fs")
const path = require("path")

const dashboardDist = path.join(
  __dirname,
  "..",
  "node_modules",
  "@medusajs",
  "dashboard",
  "dist"
)

const pattern = /DEFAULT_MAX_FILE_SIZE = 1024 \* 1024/g
const replacement = "DEFAULT_MAX_FILE_SIZE = Infinity"

function patchFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8")
  if (!pattern.test(content)) {
    return false
  }

  pattern.lastIndex = 0
  fs.writeFileSync(filePath, content.replace(pattern, replacement))
  return true
}

if (!fs.existsSync(dashboardDist)) {
  process.exit(0)
}

let patched = 0

for (const entry of fs.readdirSync(dashboardDist)) {
  if (!/\.(js|mjs)$/.test(entry)) {
    continue
  }

  const filePath = path.join(dashboardDist, entry)
  if (patchFile(filePath)) {
    patched += 1
    console.log(`[patch-upload-limit] ${entry}`)
  }
}

if (patched > 0) {
  console.log(`[patch-upload-limit] Removed 1MB admin upload cap in ${patched} file(s).`)
}
