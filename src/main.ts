import { HttpLayerRouter, HttpServerResponse } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { SlashCommandBuilder } from "discord.js";
import { Effect, Layer, Logger, pipe } from "effect";
import { Discord } from "./pkgs/discord";
import { Otel } from "./pkgs/otel";

const Main = Layer.effectDiscard(
	Effect.gen(function* () {
		const discord = yield* Discord;

		yield* discord.registerSlashCommand({
			command: new SlashCommandBuilder()
				.setName("ping")
				.setDescription("Replies with Pong!"),
			execute: (interaction) =>
				pipe(
					Effect.tryPromise(() => interaction.reply("Pong!")),
					Effect.catchAll(() =>
						Effect.logError("Failed to reply to ping command."),
					),
				),
		});

		yield* discord.registerCommands();

		yield* Effect.forkDaemon(discord.listen());
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
	Layer.provide(Discord.Default),
	Layer.provide([Otel.layer, Logger.structured]),
);

BunRuntime.runMain(Layer.launch(AppLayer));
