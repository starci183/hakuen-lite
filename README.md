# hakuen-lite

One StarCi lite app of the sides be, packages.

## Overview

The HAKUEN Hotel & Spa project on the NIVO platform, laid out like `nivo-web-lite`: a REST back end (`be/`, the shop's back
office to come: rooms, rates, bookings, stays, folios, read by NIVO's generic OpenAPI provider) and the private plugin package
`packages/hakuen-core` (the shop's agents as a composition of NIVO functional modules and providers; what the old NIVO code did
that this frame cannot express yet is `packages/hakuen-core/LEGACY.md`). Today the back end is the fresh scaffold.

This repository is public and holds no shop data: names of people, prices, limits, documents, policy and the enterprise seed
live only in the private, sops-sealed `starci183/hakuen-lite-data`.

One StarCi lite app with no front end (fe): `hfs.json` declares its sides (`sides`), and `.starcistacks/application-stacks.yaml` states the same ones. Dev ports start at base 3300 (api 3301).

## Stack

TypeScript everywhere: NestJS in `be/` serving REST with an OpenAPI 3 document (@nestjs/swagger), TypeScript workspace packages in `packages/`, PostgreSQL with SQL migrations in `db/`; npm workspaces and Turbo for the workspace tasks.

## Repository layout

- `be/`: the Nest back end, its api app in `be/apps/api`, serving REST controllers described by the committed OpenAPI document `be/contracts/api/openapi.json` (`npm run contract:emit` writes it).
- `packages/`: the root workspace packages, `packages/hakuen-lite-shared` first, built with `npm run build:modules`.
- `db/`: the SQL migrations, the schema authority of the database.

## Development

```sh
npm install
npm run contract:emit
npm run typecheck
npm run lint
npm test
npm run build:be
```

## Work

Work records live in `.starciwork/`; `.starciwork/workspace.yaml` supplies the project id and the repository roles the Work tools read.
