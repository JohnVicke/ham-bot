import { Socket } from "@effect/platform";
import {
	Config,
	Duration,
	Effect,
	HashMap,
	Redacted,
	Ref,
	Schedule,
	Schema,
} from "effect";
import { DiscordHttp } from "./http";
import { Interaction, type SlashCommand } from "./schemas";

type SocketWriter = (
	chunk: Uint8Array | string | Socket.CloseEvent,
) => Effect.Effect<void, Socket.SocketError>;

export interface CommandContext {
	readonly interaction: Interaction;
	readonly respond: (content: string) => Effect.Effect<void>;
	readonly defer: () => Effect.Effect<void>;
	readonly getOption: <T>(name: string) => Effect.Effect<T, Error>;
}

export type CommandHandler<Opts = unknown> = (
	ctx: CommandContext,
	options: Opts,
) => Effect.Effect<void>;

export interface Command<Opts = unknown> {
	readonly schema: SlashCommand;
	readonly optionsParser?: Schema.Schema<Opts, unknown>;
	readonly handler: CommandHandler<Opts>;
}

const HelloMessage = Schema.TaggedStruct("Hello", {
	op: Schema.Literal(10),
	d: Schema.Struct({ heartbeat_interval: Schema.Number }),
});

const ReadyMessage = Schema.TaggedStruct("Ready", {
	t: Schema.Literal("READY"),
	op: Schema.Literal(0),
	d: Schema.Struct({
		resume_gateway_url: Schema.String,
		session_id: Schema.String,
	}),
});

const HeartbeatAckMessage = Schema.TaggedStruct("HeartbeatAck", {
	op: Schema.Literal(11),
});

const GuildCreateMessage = Schema.TaggedStruct("GuildCreate", {
	t: Schema.Literal("GUILD_CREATE"),
	op: Schema.Literal(0),
	d: Schema.Unknown,
});

const InteractionCreateMessage = Schema.TaggedStruct("InteractionCreate", {
	t: Schema.Literal("INTERACTION_CREATE"),
	op: Schema.Literal(0),
	d: Interaction,
});

const JsonEncoded = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
	Schema.compose(Schema.String, Schema.parseJson(schema));

const TextDecoded = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
	Schema.transform(Schema.Uint8Array, Schema.parseJson(schema), {
		strict: true,
		decode: (bytes) => new TextDecoder().decode(bytes),
		encode: (str) => new TextEncoder().encode(str),
	});

const HeartbeatPayload = Schema.Struct({
	op: Schema.Literal(1),
	d: Schema.Null,
});

const IdentifyPayload = Schema.Struct({
	op: Schema.Literal(2),
	d: Schema.Struct({
		token: Schema.String,
		intents: Schema.Number,
		properties: Schema.Struct({
			os: Schema.String,
			browser: Schema.String,
			device: Schema.String,
		}),
	}),
});

const OutboundMessage = JsonEncoded(
	Schema.Union(HeartbeatPayload, IdentifyPayload),
);

type OutboundMessage = Schema.Schema.Type<typeof OutboundMessage>;

const InboundMessage = TextDecoded(
	Schema.Union(
		ReadyMessage,
		HelloMessage,
		GuildCreateMessage,
		HeartbeatAckMessage,
		InteractionCreateMessage,
	),
);

export class DiscordGateway extends Effect.Service<DiscordGateway>()(
	"DiscordGateway",
	{
		dependencies: [DiscordHttp.Default],
		effect: Effect.gen(function* () {
			const authenticated = yield* Ref.make(false);

			const token = yield* Config.redacted("DISCORD_TOKEN");
			const api = yield* DiscordHttp;
			const commandsRef = yield* Ref.make(
				HashMap.empty<string, Command<any>>(),
			);

			const register = <Opts>(cmd: Command<Opts>) =>
				Ref.update(commandsRef, (cmds) =>
					HashMap.set(cmds, cmd.schema.name, cmd),
				);

			const syncCommands = Effect.gen(function* () {
				const commands = yield* Ref.get(commandsRef);
				yield* api.syncCommands(
					HashMap.toValues(commands).map((s) => s.schema),
				);
			});

			const sendGatewayMessage = (
				writer: SocketWriter,
				payload: OutboundMessage,
			) =>
				Effect.gen(function* () {
					const encoded = yield* Schema.encode(OutboundMessage)(payload);
					yield* writer(encoded);
				});

			const identify = (writer: SocketWriter) =>
				Effect.gen(function* () {
					yield* sendGatewayMessage(writer, {
						op: 2,
						d: {
							token: Redacted.value(token),
							intents: 1 << 0, // GUILDS intent
							properties: {
								os: "linux",
								browser: "effect-discord",
								device: "effect-discord",
							},
						},
					});
					yield* Effect.log("Sent IDENTIFY");
				});

			const startHeartbeat = (writer: SocketWriter, interval: number) =>
				Effect.gen(function* () {
					yield* Effect.repeat(
						Effect.gen(function* () {
							yield* sendGatewayMessage(writer, { op: 1, d: null });
							yield* Effect.logDebug("Sent heartbeat");
						}),
						Schedule.spaced(Duration.millis(interval)),
					);
				});

			const connect = () =>
				Effect.gen(function* () {
					const ws = yield* Socket.makeWebSocket(
						"wss://gateway.discord.gg/?v=10&encoding=json",
					);

					const writer = yield* ws.writer;

					yield* ws
						.run((data) =>
							Effect.gen(function* () {
								const decoded =
									yield* Schema.decodeUnknown(InboundMessage)(data);

								const isAuthenticated = yield* Ref.get(authenticated);

								if (decoded._tag === "Hello") {
									yield* Effect.forkDaemon(
										startHeartbeat(writer, decoded.d.heartbeat_interval),
									);
								}

								if (decoded._tag === "HeartbeatAck" && !isAuthenticated) {
									yield* identify(writer).pipe(
										Effect.tap(() => Ref.set(authenticated, true)),
									);
								}

								if (decoded._tag === "InteractionCreate") {
									yield* Effect.log("Interaction create");

									const commands = yield* Ref.get(commandsRef);

									const cmd = HashMap.get(commands, decoded.d.data.name);

									if (cmd._tag === "None") {
										yield* Effect.logWarning("Command not found", {
											name: decoded.d.data.name,
										});
										return;
									}

									const ctx = {
										interaction: decoded.d,
										getOption: <T>(name) =>
											Effect.gen(function* () {
												yield* Effect.log("get option");
												return "" as T;
											}),
										defer: Effect.fn(function* () {
											yield* Effect.log("defer");
										}),
										respond: (content: string) =>
											api
												.respondToInteraction({
													interactionId: decoded.d.id,
													token: decoded.d.token,
													content,
												})
												.pipe(Effect.catchAll((e) => Effect.logError(e))),
									} satisfies CommandContext;

									yield* cmd.value.handler(ctx, {});
								}
							}),
						)
						.pipe(Effect.catchAll((e) => Effect.logError(e)));
				});

			return { register, syncCommands, connect } as const;
		}),
	},
) {}
