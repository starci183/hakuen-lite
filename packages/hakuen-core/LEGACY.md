# hakuen-core: what was parked

On 2026-11-13 the HAKUEN shop left the NIVO repository (owner order). There it was back-end code of NIVO's `be/`
(`workspace-seed/profiles/hakuen-*.templates.ts`, the office seed and its authority, the `seed-workspace profile|office`
cli and a `seed demo workspace` deploy workflow). Its DATA moved, sealed, to the private `hakuen-lite-data` repository; this
package keeps the shape of the business (`src/plugin.ts`). What follows could not be expressed in the new frame and is parked
here as a description, not as code. This file names no shop value: every number, name and text it mentions is in
`hakuen-lite-data`.

## Binding to agent-sdk

The NIVO plugin contract (`defineModule`, `defineTemplateAgent`, graphs, nodes, guidance, workbench specs, as
`nivo-web-core` uses them) is `@nivo-lite/agent-sdk` and `@nivo-lite/blocks-core`, workspace packages of the NIVO repository
that no registry serves. This package cannot import them, so `src/plugin.types.ts` writes the few fields it needs locally.
Open: once agent-sdk is installable (local registry, then npm), `plugin.ts` becomes a real plugin: one bundle per agent with
its module declaration, catalogue template and template agent, and the local types go.

## Template agents and graphs

The five agents had no graphs: they were rows (`AgentRecordsService.ensureByHandle`) plus installations in `setup` / `assist`
mode, each with free-text `role` and `instructions` and setup-gate answers (`setup[]`). In the new frame an agent is a template
agent with graphs; HAKUEN's are still to be drawn on the blocks-core modules they compose (content, video, booking, chatbot,
sales). The texts and setup answers are in `hakuen-lite-data` `data/profile.json`.
Changed on the move: the sales agent composed `chatbot`; it now names `booking`, the blocks-core module for bookings (a
decision of the move, to confirm with the owner).

## The HAKUEN connector over MCP

The back office (rooms, rates, holds, bookings, stays, guests, folios, key codes) was a remote MCP server `hakuen` (contract
`hakuen-mcp@1`) registered by the seed, its catalog approved by the owner, its tools `hakuen.rooms.searchAvailability`,
`hakuen.rates.quote`, `hakuen.booking.hold|confirm`, `hakuen.folio.*`, `hakuen.stay.*`, `hakuen.guest.*`,
`hakuen.keycode.reveal`. The NIVO engine no longer uses MCP (outbound only). New frame: the back office is the REST api of
`hakuen-lite` (`be/`, contract `rest`, its committed OpenAPI), reached by NIVO's generic `openapi` provider, its operations
named `<namespace>.<operationId>`. None of those operations is built yet: the api is the fresh scaffold.

## Tool grants with argument bounds

Each agent had per-tool grants (`mcp_tool_grants`: mode `auto` / `ask`, `limit_vnd`, argument bounds such as a maximum discount)
written by the seed. New frame: a node declares `auto` or `ask` per tool; hard rights sit on provider abilities; a bound on an
argument has no place yet (open).

## Authority rules, approver groups and member grants

The profile's `rules[]` (department, action, mode, VND limit, required fields) and the office story's rules with bands
(`auto_max`, `ask_max`, unit percent / vnd / count), approver groups by role, room or member, an approval policy and a timeout,
plus per-member approval limits, were the retired authority model (`authority_rules`, member grants; "Giao quyền" was deleted).
New frame: soft policy is inferred from the truth graph, so these become policy documents the owner uploads; the values are in
`hakuen-lite-data` `data/profile.json` and `data/office-authority.json`.

## The office story (UAT)

A UAT workspace with five people (owner, two managers, two staff), four agents each with a person in charge, a fallback, the
roles and rooms that may be assigned, and the agents it may tag. New frame: people are workspace members and the hand-offs are
`callWorkflow` between agents; rooms and tagging have no direct equivalent. Data: `hakuen-lite-data` `data/office.json`.

## Knowledge documents

Twelve documents (brand guide, room types, spa menu, front desk, discount policy, tax profile, e-invoice and tax-calendar
notes, operations, post templates, two playbooks) were seeded as `knowledge_sources` rows with an outbox job each. New frame:
they are upload material for the Second Brain (ingestion), never seeded as foundation. Data: `data/documents.json`.

## Seeding and deploy

`seed-workspace profile --profile hakuen` and `seed-workspace office` (dry run by default, inputs from sealed custody) and the
GitHub workflow that ran them on production. New frame: an enterprise seed carries foundation only (the workspace, its
identifier, installed plugins); the document is `hakuen-lite-data` `data/enterprise.json` (`target: off`). Nothing hands it to
NIVO yet, and its `ownerWorkspace` is to confirm with the owner.

## The logo

`/brand/hakuen-logo.jpg`, a file of NIVO's web app. Not moved: no binaries in git; its home is the workspace's file store.
