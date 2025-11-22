import {
	type CacheType,
	type ChatInputCommandInteraction,
	Client,
	Events,
	GatewayIntentBits,
	REST,
	Routes,
	type SlashCommandBuilder,
} from "discord.js";
import { Config, Effect, HashMap, Redacted, Ref } from "effect";

interface SlashCommand {
	command: SlashCommandBuilder;
	execute: (
		interaction: ChatInputCommandInteraction<CacheType>,
	) => Effect.Effect<void, never, never>;
}

export class Discord extends Effect.Service<Discord>()("Discord ", {
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
							const command = HashMap.get(commands, interaction.commandName);

							if (command._tag === "None") {
								yield* Effect.logWarning(
									`Unknown command: ${interaction.commandName}`,
								);
								return;
							}

							yield* command.value.execute(interaction);
						}),
					);
				});
			}).pipe(Effect.withSpan("discord_listen"));

		const registerCommands = () =>
			Effect.gen(function* () {
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
			}).pipe(Effect.withSpan("discord_register_commands"));

		return { registerSlashCommand, registerCommands, listen } as const;
	}),
}) {}
