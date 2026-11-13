import en from "./messages/en.json"
import vi from "./messages/vi.json"
import type { HakuenAgent, HakuenAgentWords, HakuenLocale, HakuenPlugin } from "./plugin.types"

/** The enterprise identifier of the HAKUEN workspace (the string beside its uuid, set only by the seed or the platform admin). */
export const HAKUEN_ENTERPRISE = "hakuen"

/** The agent keys the locale files word. */
type HakuenAgentKey = keyof typeof en.agents

/** The plugin's words, by language (product copy lives in the locale files, never in code). */
const MESSAGES: Readonly<
    Record<HakuenLocale, { readonly agents: Readonly<Record<HakuenAgentKey, HakuenAgentWords>> }>
> = { vi, en }

/** The words of one agent in both languages, from the locale files. */
export const wordsOf = (key: HakuenAgentKey): HakuenAgent["words"] => ({
    vi: MESSAGES.vi.agents[key],
    en: MESSAGES.en.agents[key],
})

/**
 * The hakuen-core plugin: HAKUEN Hotel & Spa's five agents, each a composition of a NIVO functional module and the providers it
 * attaches. It holds the shape of the business only: every shop value (names, prices, limits, documents, setup answers, policy)
 * is data of the private hakuen-lite-data repository, and soft policy is read from the workspace's truth graph, never from here.
 * It declares no tool, api, table or record type of its own.
 */
export const HAKUEN_PLUGIN: HakuenPlugin = {
    packageName: "hakuen-core",
    visibility: "private",
    enterpriseIdentifiers: [HAKUEN_ENTERPRISE],
    agents: [
        {
            key: "marketing",
            handle: "ai-marketing",
            composes: "content",
            accounts: ["meta", "zalo_oa"],
            words: wordsOf("marketing"),
        },
        {
            key: "editor",
            handle: "ai-editor",
            composes: "video",
            accounts: ["veo", "elevenlabs"],
            words: wordsOf("editor"),
        },
        {
            key: "sales",
            handle: "ai-sales",
            composes: "booking",
            accounts: ["zalo_oa", "meta", "openapi"],
            words: wordsOf("sales"),
        },
        {
            key: "care",
            handle: "ai-cskh",
            composes: "chatbot",
            accounts: ["zalo_oa", "meta", "openapi"],
            words: wordsOf("care"),
        },
        {
            key: "books",
            handle: "ai-ke-toan",
            composes: "sales",
            accounts: ["sepay", "openapi"],
            words: wordsOf("books"),
        },
    ],
    recordTypes: [],
}
