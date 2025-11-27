import { Schema } from "effect";
import { TaggedStruct } from "../../schema/tagged-struct";
import { Interaction } from "./interaction-schemas";

export const HelloMessage = TaggedStruct("Hello", {
	op: Schema.Literal(10),
	d: Schema.Struct({ heartbeat_interval: Schema.Number }),
});

export const ReadyMessage = TaggedStruct("Ready", {
	t: Schema.Literal("READY"),
	op: Schema.Literal(0),
	d: Schema.Struct({
		guilds: Schema.Array(Schema.Struct({ id: Schema.String })),
		resume_gateway_url: Schema.String,
		session_id: Schema.String,
	}),
});

export const HeartbeatAckMessage = TaggedStruct("HeartbeatAck", {
	op: Schema.Literal(11),
});

export const GuildCreateMessage = TaggedStruct("GuildCreate", {
	t: Schema.Literal("GUILD_CREATE"),
	op: Schema.Literal(0),
	d: Schema.Unknown,
});

export const InteractionCreateMessage = TaggedStruct("InteractionCreate", {
	t: Schema.Literal("INTERACTION_CREATE"),
	op: Schema.Literal(0),
	d: Interaction,
});

export const HeartbeatPayload = TaggedStruct("Heartbeat", {
	op: Schema.Literal(1),
	d: Schema.Null,
});

export const IdentifyPayload = TaggedStruct("Identify", {
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

export const OutboundMessage = Schema.Union(HeartbeatPayload, IdentifyPayload);

export type OutboundMessage = Schema.Schema.Type<typeof OutboundMessage>;

export const GatewayEvent = Schema.Union(
	InteractionCreateMessage,
	ReadyMessage,
);

export type GatewayEvent = Schema.Schema.Type<typeof GatewayEvent>;

export const InboundMessage = Schema.Union(
	ReadyMessage,
	HelloMessage,
	GuildCreateMessage,
	HeartbeatAckMessage,
	InteractionCreateMessage,
);

export type InboundMessage = Schema.Schema.Type<typeof InboundMessage>;

export type GatewayEventTypeToEvent = {
	[T in GatewayEvent["_tag"]]: Extract<GatewayEvent, { _tag: T }>;
};
