import { HttpLayerRouter, HttpServerResponse } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import {
	type CacheType,
	type ChatInputCommandInteraction,
	Client,
	Events,
	GatewayIntentBits,
	REST,
	Routes,
	SlashCommandBuilder,
} from "discord.js";
import { Config, Effect, HashMap, Layer, Redacted, Ref } from "effect";

interface SlashCommand {
	command: SlashCommandBuilder;
	execute: (
		interaction: ChatInputCommandInteraction<CacheType>,
	) => Effect.Effect<void, never, never>;
}

class Discord extends Effect.Service<Discord>()("Discord ", {
	effect: Effect.gen(function* () {
		const commandsRef = yield* Ref.make(HashMap.empty<string, SlashCommand>());

		const token = yield* Config.redacted("DISCORD_TOKEN");

		const client = new Client({
			intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
		});

		const rest = new REST().setToken(Redacted.value(token));

		const [readyClient] = yield* Effect.all(
			[
				Effect.async<Client<true>>((resume) => {
					client.once(Events.ClientReady, (readyClient) => {
						resume(Effect.succeed(readyClient));
					});
				}),
				Effect.tryPromise({
					try: () => client.login(Redacted.value(token)),
					catch: (error) =>
						new Error(`Failed to login to Discord: ${String(error)}`),
				}),
			],
			{ concurrency: "unbounded" },
		);

		const registerSlashCommand = Effect.fn(function* (command: SlashCommand) {
			yield* Ref.update(commandsRef, (commands) =>
				HashMap.set(commands, command.command.name, command),
			);
		});

		const listen = () =>
			Effect.async<void>(() => {
				client.on(Events.InteractionCreate, async (interaction) => {
					if (!interaction.isChatInputCommand()) return;

					await Effect.runPromise(
						Effect.gen(function* () {
							const commands = yield* Ref.get(commandsRef);

							if (!HashMap.has(commands, interaction.commandName)) {
								return;
							}

							yield* Effect.tryPromise({
								try: async () => {
									if (interaction.commandName === "ping") {
										await interaction.reply("Pong!");
									} else {
										await interaction.reply(
											`Unknown command: ${interaction.commandName}`,
										);
									}
								},
								catch: (error) => {
									Effect.logError(
										`Failed to execute command ${interaction.commandName}: ${String(
											error,
										)}`,
									);
								},
							});
						}),
					);
				});
			});

		const registerCommands = Effect.fn(function* () {
			const commands = yield* Ref.get(commandsRef);

			const body = HashMap.toValues(commands).map((command) =>
				command.command.toJSON(),
			);

			yield* Effect.tryPromise({
				try: () =>
					rest.put(Routes.applicationCommands(readyClient.user.id), { body }),
				catch: (error) =>
					new Error(`Failed to register commands: ${String(error)}`),
			});

			yield* Effect.log("Successfully registered application commands.", {
				registeredCommands: body.length,
			});
		});

		return { registerSlashCommand, registerCommands, listen } as const;
	}),
}) {}

const Main = Layer.effectDiscard(
	Effect.gen(function* () {
		const discord = yield* Discord;

		yield* discord.registerSlashCommand({
			command: new SlashCommandBuilder()
				.setName("ping")
				.setDescription("Replies with Pong!"),
			execute: (interaction) =>
				Effect.tryPromise({
					try: () => interaction.reply("Pong!"),
					catch: (error) =>
						Effect.logError(`Failed to execute ping command: ${String(error)}`),
				}).pipe(
					Effect.catchAll(() =>
						Effect.logError("Failed to reply to ping command."),
					),
				),
		});

		yield* discord.registerCommands();

		yield* Effect.forkDaemon(discord.listen());
	}),
).pipe(Layer.provide(Discord.Default));

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

const AppLayer = Layer.mergeAll(Main, HttpLive);

BunRuntime.runMain(Layer.launch(AppLayer));
