import { loadPackagesHfs as loadBePackages, starciBePackagesConfig } from "@starci/eslint-canon-be"

const be = loadBePackages(import.meta.url)

export default [...(await starciBePackagesConfig({ hfs: be }))]
