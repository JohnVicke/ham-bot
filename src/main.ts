import { HttpLayerRouter, HttpServerResponse, Socket } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import {
	type Command,
	type CommandContext,
	DiscordGateway,
} from "./pkgs/dicord/discord-gateway";
import type { SlashCommand } from "./pkgs/dicord/schemas";
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

const Main = Layer.scopedDiscard(
	Effect.gen(function* () {
		const gateway = yield* DiscordGateway;
		yield* gateway.register(pingCommand);
		yield* gateway.syncCommands;
		yield* Effect.forkDaemon(gateway.connect());
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
	Layer.provide(DiscordGateway.Default),
	Layer.provide(Socket.layerWebSocketConstructorGlobal),
	Layer.provide([Otel.layer, Logger.structured]),
);

BunRuntime.runMain(Layer.launch(AppLayer));
