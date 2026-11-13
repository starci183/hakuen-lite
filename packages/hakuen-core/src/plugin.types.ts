/**
 * The shape of the hakuen-core plugin, written locally because the NIVO plugin contract (`@nivo-lite/agent-sdk`) is a workspace
 * package of the NIVO repository and no registry serves it yet (LEGACY.md "Binding to agent-sdk"). Types only: no value, no logic.
 */

/** A language the plugin's words are written in. */
export type HakuenLocale = "vi" | "en"

/** A NIVO functional module of `@nivo-lite/blocks-core` an agent of the plugin composes, by its module key. */
export type HakuenComposedModule = "content" | "video" | "booking" | "chatbot" | "sales"

/**
 * A provider kind an agent attaches accounts of (NIVO provider registry ids). `openapi` is NIVO's generic OpenAPI-reading
 * provider pointed at the HAKUEN back office, the REST api of hakuen-lite.
 */
export type HakuenProviderKind = "meta" | "zalo_oa" | "sepay" | "veo" | "elevenlabs" | "openapi"

/** The words of one agent in one language: its catalogue label and a one-line job. */
export interface HakuenAgentWords {
    /** The catalogue label, shown as "HAKUEN-<label>". */
    readonly label: string
    /** What the agent does, one line, with no shop value (no price, limit, person or channel id). */
    readonly job: string
}

/** One agent of the plugin: the `<agent>` of its record types, the module it composes, the accounts it attaches. */
export interface HakuenAgent {
    /** The agent key: the `<agent>` part of `hakuen-core.<agent>.<domain>`, kebab case. */
    readonly key: string
    /** The handle the workspace shows. */
    readonly handle: string
    /** The functional module it is a composition of. */
    readonly composes: HakuenComposedModule
    /** The provider kinds whose accounts it attaches (the kill switch is detaching them). */
    readonly accounts: ReadonlyArray<HakuenProviderKind>
    /** Its words, by language. */
    readonly words: Readonly<Record<HakuenLocale, HakuenAgentWords>>
}

/** The plugin as the NIVO installation would take it. */
export interface HakuenPlugin {
    /** The npm name without its scope: the `<package>` of every record type and read. */
    readonly packageName: "hakuen-core"
    /** A private plugin: only a workspace carrying one of these enterprise identifiers sees, installs and runs it. */
    readonly visibility: "private"
    /** The enterprise identifiers it belongs to. */
    readonly enterpriseIdentifiers: ReadonlyArray<string>
    /** Its agents, in catalogue order. */
    readonly agents: ReadonlyArray<HakuenAgent>
    /** The record types it declares: none, the shop's bookings, stays and folios are the back office's (hakuen-lite be). */
    readonly recordTypes: ReadonlyArray<never>
}
