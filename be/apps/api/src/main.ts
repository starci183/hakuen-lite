import { NestFactory } from "@nestjs/core"
import { SwaggerModule } from "@nestjs/swagger"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { applyHttpSecurity } from "@modules/platform/http-security"
import { SystemIds } from "@modules/platform/ids"
import { applyCorrelation, createJsonLogger, createNestLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { readApiEnv } from "./api.env"
import { OPENAPI } from "./openapi"

/** Reads the environment once, composes the app from the parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options = readApiEnv(env)
    const logger = createJsonLogger(new SystemClockService(), new SystemIds())
    const app = await NestFactory.create(AppModule.register(options), {
        rawBody: true,
        logger: createNestLogger(logger),
    })
    applyCorrelation(app)
    applyHttpSecurity(app, options.httpSecurity, { trustProxy: 1 })
    // Serves the OpenAPI document of the rest contract over the head the emit reads (BE-TRANSPORT-4).
    SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, OPENAPI))
    app.enableShutdownHooks()
    await app.listen(options.server.port)
    logger.info(LoggingLogEvent.ServerStarted, {
        service: "api",
        port: options.server.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService(), new SystemIds()).error(LoggingLogEvent.StartupFailed, error, {
        service: "api",
    })
    process.exitCode = 1
})
