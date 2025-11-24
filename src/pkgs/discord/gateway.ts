import { Socket } from "@effect/platform";
import {
	Config,
	Duration,
	Effect,
	Redacted,
	Ref,
	Schedule,
	Schema,
} from "effect";
import { TaggedStruct } from "../schema/tagged-struct";
import { DiscordGatewayEventBus } from "./event-bus";
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

const HelloMessage = TaggedStruct("Hello", {
	op: Schema.Literal(10),
	d: Schema.Struct({ heartbeat_interval: Schema.Number }),
});

const ReadyMessage = TaggedStruct("Ready", {
	t: Schema.Literal("READY"),
	op: Schema.Literal(0),
	d: Schema.Struct({
		resume_gateway_url: Schema.String,
		session_id: Schema.String,
	}),
});

const HeartbeatAckMessage = TaggedStruct("HeartbeatAck", {
	op: Schema.Literal(11),
});

const GuildCreateMessage = TaggedStruct("GuildCreate", {
	t: Schema.Literal("GUILD_CREATE"),
	op: Schema.Literal(0),
	d: Schema.Unknown,
});

const InteractionCreateMessage = TaggedStruct("InteractionCreate", {
	t: Schema.Literal("INTERACTION_CREATE"),
	op: Schema.Literal(0),
	d: Interaction,
});

const HeartbeatPayload = TaggedStruct("Heartbeat", {
	op: Schema.Literal(1),
	d: Schema.Null,
});

const IdentifyPayload = TaggedStruct("Identify", {
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

const OutboundMessage = Schema.Union(HeartbeatPayload, IdentifyPayload);

type OutboundMessage = Schema.Schema.Type<typeof OutboundMessage>;

export const GatewayEvent = Schema.Union(InteractionCreateMessage);

export type GatewayEvent = Schema.Schema.Type<typeof GatewayEvent>;

const InboundMessage = Schema.Union(
	ReadyMessage,
	HelloMessage,
	GuildCreateMessage,
	HeartbeatAckMessage,
	InteractionCreateMessage,
);

export type InboundMessage = Schema.Schema.Type<typeof InboundMessage>;

export class DiscordGateway extends Effect.Service<DiscordGateway>()(
	"DiscordGateway",
	{
		dependencies: [DiscordGatewayEventBus.Default],
		effect: Effect.gen(function* () {
			const bus = yield* DiscordGatewayEventBus;
			const authenticated = yield* Ref.make(false);

			const token = yield* Config.redacted("DISCORD_TOKEN");

			const sendGatewayMessage = (
				writer: SocketWriter,
				payload: OutboundMessage,
			) =>
				Effect.gen(function* () {
					const encoded = yield* Schema.encode(Schema.parseJson())(payload);
					yield* writer(encoded);
				});

			const identify = (writer: SocketWriter) =>
				Effect.gen(function* () {
					yield* sendGatewayMessage(writer, {
						_tag: "Identify",
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
				});

			const startHeartbeat = (writer: SocketWriter, interval: number) =>
				Effect.gen(function* () {
					yield* Effect.repeat(
						Effect.gen(function* () {
							yield* sendGatewayMessage(writer, {
								_tag: "Heartbeat",
								op: 1,
								d: null,
							});
							yield* Effect.logDebug("Sent heartbeat");
						}),
						Schedule.spaced(Duration.millis(interval)),
					);
				});

			const connect = Effect.fn(function* (url: string) {
				const ws = yield* Socket.makeWebSocket(url);

				const writer = yield* ws.writer;

				yield* ws
					.run(
						Effect.fn(function* (data) {
							const text = new TextDecoder().decode(data);

							const decoded = yield* Schema.decodeUnknown(
								Schema.parseJson(InboundMessage),
							)(text);

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
								yield* bus.publish(decoded);
							}
						}),
					)
					.pipe(Effect.catchAll((e) => Effect.logError(e)));
			});

			return { connect } as const;
		}),
	},
) {}
