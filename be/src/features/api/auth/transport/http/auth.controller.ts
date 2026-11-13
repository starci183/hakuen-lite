// Managed by starci app sync (slot be.feature.auth); do not edit: run "npx starci app sync --execute".
import { Body, Controller, Get, HttpCode, Post, Query, Redirect, Req, Res } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { Request, Response } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import type { AccessGrant, GoogleRedirect, JwksDocument } from "@modules/integrations/passport"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { SignupCommand } from "../../application/signup.command"
import { ResendCommand } from "../../application/resend.command"
import { ConfirmCommand } from "../../application/confirm.command"
import { ForgotCommand } from "../../application/forgot.command"
import { ResetCommand } from "../../application/reset.command"
import { GetJwksQuery } from "../../application/get-jwks.query"
import { GoogleBeginCommand } from "../../application/google-begin.command"
import { GoogleCompleteCommand } from "../../application/google-complete.command"
import { LoginCommand } from "../../application/login.command"
import { LogoutCommand } from "../../application/logout.command"
import { RefreshCommand } from "../../application/refresh.command"
import { SessionCommand } from "../../application/session.command"
import { ForgotRequest } from "./dto/forgot.request"
import { GoogleStartRequest } from "./dto/google-start.request"
import { LoginRequest } from "./dto/login.request"
import { ResendRequest } from "./dto/resend.request"
import { ResetRequest } from "./dto/reset.request"
import { SignupRequest } from "./dto/signup.request"
import { TokenRequest } from "./dto/token.request"
import {
    ApiDefaultResponse,
    ApiExtension,
    ApiFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiProperty,
} from "@nestjs/swagger"

/** The one error body every operation answers as `default`: its machine code and its message. */
class ErrorResponse {
    /** The machine code of the failure, stable across releases. */
    @ApiProperty() readonly code!: string
    /** The failure in words, from the messages catalog. */
    @ApiProperty() readonly message!: string
}

/** The signed-in person an access grant names. */
class SessionUserResponse {
    /** The user id. */
    @ApiProperty() readonly id!: string
    /** The account email. */
    @ApiProperty() readonly email!: string
    /** The person's full name, when the account has one. */
    @ApiProperty({ required: false }) readonly name?: string
}

/** An access token and when it stops being accepted. */
class AccessGrantResponse {
    /** The access JWT, to be sent as a Bearer token. */
    @ApiProperty() readonly accessToken!: string
    /** How many seconds the access token lives. */
    @ApiProperty() readonly expiresIn!: number
    /** When the access token stops being accepted, ISO 8601. */
    @ApiProperty() readonly expiresAt!: string
    /** The signed-in person. */
    @ApiProperty({ type: SessionUserResponse }) readonly user!: SessionUserResponse
}

/** The public keys access tokens verify against. */
class JwksResponse {
    /** The public keys, each a JSON Web Key. */
    @ApiProperty({ type: "array", items: { type: "object" } }) readonly keys!: Array<Record<string, string>>
}

@Controller("auth")
@ApiDefaultResponse({ type: ErrorResponse })
/** The cookie doors of sign-in: email and password, the email doors (sign up, confirm, resend, forgot, reset), Google, refresh, session, sign-out and the public keys. */
export class AuthController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Signs in with email and password; the refresh token is set as an httpOnly cookie. */
    @Post("login")
    @ApiOperation({ operationId: "auth.login", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @ApiOkResponse({ type: AccessGrantResponse })
    @HttpCode(200)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    login(
        @Body() _body: LoginRequest,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AccessGrant> {
        return this.commandBus.execute(new LoginCommand({ request: { exchange: { req, res } } }))
    }

    /** Rotates the refresh cookie and answers a new access token; a bad cookie is cleared. */
    @Post("refresh")
    @ApiOperation({ operationId: "auth.refresh", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @ApiOkResponse({ type: AccessGrantResponse })
    @HttpCode(200)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AccessGrant> {
        return this.commandBus.execute(new RefreshCommand({ request: { exchange: { req, res } } }))
    }

    /** Answers a fresh access token for the cookie session WITHOUT rotating the cookie, so parallel requests of one browser never race. */
    @Get("session")
    @ApiOperation({ operationId: "auth.session", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @ApiOkResponse({ type: AccessGrantResponse })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    session(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AccessGrant> {
        return this.commandBus.execute(new SessionCommand({ request: { exchange: { req, res } } }))
    }

    /** Ends the session of the refresh cookie and clears it. */
    @Post("logout")
    @ApiOperation({ operationId: "auth.logout", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        return this.commandBus.execute(new LogoutCommand({ request: { exchange: { req, res } } }))
    }

    /** Sends the browser to Google (authorization code with state and PKCE); `returnTo` is an absolute address on the web origin or a path. */
    @Get("google")
    @ApiOperation({ operationId: "auth.google", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @ApiFoundResponse()
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    google(@Query() _query: GoogleStartRequest, @Req() req: Request, @Res() res: Response): Promise<void> {
        return this.commandBus.execute(new GoogleBeginCommand({ request: { exchange: { req, res } } }))
    }

    /** Google sends the browser back here; the session cookie is set and the browser lands on the web app (or its sign-in page on failure). */
    @Get("google/callback")
    @ApiOperation({ operationId: "auth.googleCallback", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @ApiFoundResponse()
    @Redirect()
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<GoogleRedirect> {
        return this.commandBus.execute(new GoogleCompleteCommand({ request: { exchange: { req, res } } }))
    }

    /** Creates an unconfirmed account and mails the confirmation link; always answers 204. */
    @Post("signup")
    @ApiOperation({ operationId: "auth.signup", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    signup(@Body() body: SignupRequest): Promise<void> {
        return this.commandBus.execute(
            new SignupCommand({
                request: { email: body.email, password: body.password, name: body.name, language: body.language },
            }),
        )
    }

    /** Mails a new confirmation link; always answers 204. */
    @Post("resend")
    @ApiOperation({ operationId: "auth.resend", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    resend(@Body() body: ResendRequest): Promise<void> {
        return this.commandBus.execute(new ResendCommand({ request: { email: body.email, language: body.language } }))
    }

    /** Spends a confirmation link; a spent, expired or unknown link is refused with IDENTITY_RESET_TOKEN_INVALID. */
    @Post("confirm")
    @ApiOperation({ operationId: "auth.confirm", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    confirm(@Body() body: TokenRequest): Promise<void> {
        return this.commandBus.execute(new ConfirmCommand({ request: { token: body.token } }))
    }

    /** Mails a password reset link when the address has an account; always answers 204. */
    @Post("forgot")
    @ApiOperation({ operationId: "auth.forgot", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    forgot(@Body() body: ForgotRequest): Promise<void> {
        return this.commandBus.execute(new ForgotCommand({ request: { email: body.email, language: body.language } }))
    }

    /** Spends a reset link and sets the new password; every session of the person ends. */
    @Post("reset")
    @ApiOperation({ operationId: "auth.reset", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    reset(@Body() body: ResetRequest): Promise<void> {
        return this.commandBus.execute(new ResetCommand({ request: { token: body.token, password: body.password } }))
    }

    /** The public keys access tokens verify against. */
    @Get("jwks")
    @ApiOperation({ operationId: "auth.jwks", security: [] })
    @ApiExtension("x-public-reason", "auth-handshake")
    @ApiOkResponse({ type: JwksResponse })
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    jwks(): Promise<JwksDocument> {
        return this.queryBus.execute(new GetJwksQuery({ request: {} }))
    }
}
