import { HttpLayerRouter, HttpServerResponse, Socket } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Config, Effect, Layer, Logger, LogLevel, pipe } from "effect";
import { BotLayerLive } from "./pkgs/discord/bot-layer";
import { PubsubSubscribers } from "./pkgs/discord/bus/subscribers/";
import {
	type Command,
	type CommandContext,
	DiscordGateway,
} from "./pkgs/discord/gateway";
import { DiscordHttp } from "./pkgs/discord/http";
import { DiscordCommandRegistry } from "./pkgs/discord/registry";
import type { SlashCommand } from "./pkgs/discord/schemas";
import { Otel } from "./pkgs/otel";

export const defineCommand = <A>(
	schema: SlashCommand,
	handler: (ctx: CommandContext) => Effect.Effect<A>,
): Command<void> => ({
	schema,
	handler: (ctx) => Effect.asVoid(handler(ctx)),
});

const pingCommand = defineCommand(
	{
		name: "ping",
		description: "Replies with Pong!",
	},
	(ctx) => ctx.respond("Pong!"),
);

const statsCommand = defineCommand(
	{
		name: "stats",
		description: "Replies with Pong!",
	},
	(ctx) => ctx.respond("Pong!"),
);

/**
 * Application configuration
 */
const AppConfig = Config.all({
	port: Config.integer("PORT").pipe(Config.withDefault(3000)),
	logLevel: Config.logLevel("LOG_LEVEL").pipe(
		Config.withDefault(LogLevel.Info),
	),
});

/**
 * Bot initialization layer that registers commands and starts the gateway connection
 */
const BotInitLayer = Layer.scopedDiscard(
	Effect.gen(function* () {
		yield* Effect.log("Initializing Discord bot");

		const http = yield* DiscordHttp;
		const gateway = yield* DiscordGateway;
		const registry = yield* DiscordCommandRegistry;

		// Register commands
		yield* pipe(
			Effect.all(
				[registry.register(pingCommand), registry.register(statsCommand)],
				{ concurrency: "unbounded" },
			),
			Effect.flatMap(() => registry.syncWithDiscord),
			Effect.tap(() =>
				Effect.log("Commands registered and synced with Discord"),
			),
		);

		// Establish gateway connection
		yield* pipe(
			http.getWssUrl(),
			Effect.map((websocketUrl) => {
				const url = new URL(websocketUrl);
				url.searchParams.set("v", "10");
				url.searchParams.set("encoding", "json");
				return url.toString();
			}),
			Effect.flatMap((url) => Effect.forkDaemon(gateway.connect(url))),
			Effect.tap(() => Effect.log("Discord gateway connection established")),
		);
	}),
);

/**
 * Health check endpoint for the application
 */
const HealthRouter = HttpLayerRouter.use((router) =>
	router.add("GET", "/health", HttpServerResponse.text("OK")),
);

/**
 * CORS configuration for the HTTP server
 */
const CorsLayer = HttpLayerRouter.cors({
	allowedOrigins: ["*"],
	allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
	allowedHeaders: ["Content-Type", "Authorization", "B3", "traceparent"],
	credentials: true,
});

/**
 * HTTP server layer with dynamic port configuration
 */
const HttpServerLayer = pipe(
	AppConfig,
	Effect.map(({ port }) =>
		HttpLayerRouter.serve(HealthRouter.pipe(Layer.provide(CorsLayer))).pipe(
			Layer.provide(BunHttpServer.layer({ port })),
			Layer.tap(() => Effect.log(`HTTP server listening on port ${port}`)),
		),
	),
	Layer.unwrapEffect,
);

/**
 * Complete application layer combining all services
 */
const AppLayer = pipe(
	AppConfig,
	Effect.map(({ logLevel }) =>
		Layer.mergeAll(BotInitLayer, HttpServerLayer, PubsubSubscribers.layer).pipe(
			Layer.provide(BotLayerLive),
			Layer.provide(Socket.layerWebSocketConstructorGlobal),
			Layer.provide([
				Otel.layer,
				Logger.structured,
				Logger.minimumLogLevel(logLevel),
			]),
		),
	),
	Layer.unwrapEffect,
);

/**
 * Main application entry point
 */
const program = pipe(
	Layer.launch(AppLayer),
	Effect.tapErrorCause((cause) =>
		Effect.logError("Application failed to start", cause),
	),
);

BunRuntime.runMain(program);
