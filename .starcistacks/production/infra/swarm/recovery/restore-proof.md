# Production recovery record

Status: pending owner execution. No backup or restore has been run by scaffolding.

The production operator owns recovery of the db service's volume `hakuen-lite-production-db-data` and both external ingress volumes, `hakuen-lite-production-ingress-data` and `hakuen-lite-production-ingress-config-data`. Provision thirty daily encrypted off-host database exports through `starci app db dump`. Retain thirty daily encrypted off-host snapshots for both ingress volumes.

Before relying on the backup policy, restore a `starci app db dump` archive and both volume snapshots into isolated infrastructure. Record the actual off-host destination, encryption custody, backup artifact digests, restoration time and operator. Verify database connectivity and the API readiness endpoint, then verify the restored TLS and ingress configuration. Attach the dated result here without credentials.
