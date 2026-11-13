import { HAKUEN_ENTERPRISE, HAKUEN_PLUGIN } from "./plugin"

describe("HAKUEN_PLUGIN", () => {
    it("is a private plugin bound to the hakuen enterprise identifier", () => {
        expect(HAKUEN_PLUGIN.packageName).toBe("hakuen-core")
        expect(HAKUEN_PLUGIN.visibility).toBe("private")
        expect(HAKUEN_PLUGIN.enterpriseIdentifiers).toEqual([HAKUEN_ENTERPRISE])
    })

    it("keys its agents uniquely, kebab case, so each can own record types hakuen-core.<agent>.<domain>", () => {
        const keys = HAKUEN_PLUGIN.agents.map((agent) => agent.key)
        expect(new Set(keys).size).toBe(keys.length)
        for (const key of keys) expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/u)
        expect(new Set(HAKUEN_PLUGIN.agents.map((agent) => agent.handle)).size).toBe(keys.length)
    })

    it("words every agent in both languages", () => {
        for (const agent of HAKUEN_PLUGIN.agents) {
            for (const locale of ["vi", "en"] as const) {
                expect(agent.words[locale].label.length).toBeGreaterThan(0)
                expect(agent.words[locale].job.length).toBeGreaterThan(0)
            }
        }
    })

    it("declares no record type: the shop's bookings, stays and folios are the back office's", () => {
        expect(HAKUEN_PLUGIN.recordTypes).toEqual([])
    })
})
