import { HttpLayerRouter, HttpServerResponse, Socket } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { BotLayerLive } from "./pkgs/discord/bot-layer";
import { DiscordEventCoordinator } from "./pkgs/discord/coordinator";
import {
	type Command,
	type CommandContext,
	DiscordGateway,
} from "./pkgs/discord/gateway";
import { DiscordHttp } from "./pkgs/discord/http";
import { DiscordCommandRegistry } from "./pkgs/discord/registry";
import type { SlashCommand } from "./pkgs/discord/schemas";
import { Otel } from "./pkgs/otel";
import { PubgApi } from "./pkgs/pubg/http";

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

const Main = Layer.scopedDiscard(
	Effect.gen(function* () {
		const http = yield* DiscordHttp;
		const gateway = yield* DiscordGateway;
		const registry = yield* DiscordCommandRegistry;
		const coordinator = yield* DiscordEventCoordinator;
		const pubg = yield* PubgApi;

		const player = yield* pubg.findPlayerByName("Nandrolone");

		if (player._tag === "Some") {
			console.log(player.value);
			const stats = yield* pubg.getSeasonStats(player.value.id);
			console.log(stats);
		}

		yield* registry.register(pingCommand);
		yield* registry.register(statsCommand);
		yield* registry.syncWithDiscord;

		const websocketUrl = yield* http.getWssUrl();
		const url = new URL(websocketUrl);
		url.searchParams.set("v", "10");
		url.searchParams.set("encoding", "json");

		yield* Effect.forkDaemon(gateway.connect(url.toString()));
		yield* Effect.forkDaemon(coordinator.start);
	}),
);

const HealthRouter = HttpLayerRouter.use((router) =>
	router.add("GET", "/health", HttpServerResponse.text("OK")),
);

const Cors = HttpLayerRouter.cors({
	allowedOrigins: ["*"],
	allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
	allowedHeaders: ["Content-Type", "Authorization", "B3", "traceparent"],
	credentials: true,
});

const HttpLive = HttpLayerRouter.serve(
	HealthRouter.pipe(Layer.provide(Cors)),
).pipe(Layer.provide(BunHttpServer.layer({ port: 3000 })));

const AppLayer = Layer.mergeAll(Main, HttpLive).pipe(
	Layer.provide(BotLayerLive),
	Layer.provide(PubgApi.Default),
	Layer.provide(Socket.layerWebSocketConstructorGlobal),
	Layer.provide([Otel.layer, Logger.structured]),
);

BunRuntime.runMain(Layer.launch(AppLayer));
