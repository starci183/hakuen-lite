# @hakuen-lite/hakuen-core

HAKUEN Hotel & Spa's own business on the NIVO platform, as a private plugin package (`packageName: hakuen-core`, enterprise
identifier `hakuen`), the way `nivo-web-core` holds NIVO Web's. Business here is a composition: each agent names the NIVO
functional module it composes and the provider kinds whose accounts it attaches. It holds no engine, tool, api, table, record
type or seed, and no shop data: names, prices, limits, documents and policy live in the private `hakuen-lite-data` repository,
and soft policy is read from the workspace's truth graph.

- `src/plugin.ts`: the plugin and its five agents.
- `src/plugin.types.ts`: the local shape of the plugin contract (types only).
- [LEGACY.md](LEGACY.md): what the old NIVO code did that this frame cannot express yet.
