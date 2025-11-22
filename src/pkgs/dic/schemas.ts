import { Schema } from "effect";

const StringOption = Schema.Struct({
	type: Schema.Literal(3),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean),
});

const IntegerOption = Schema.Struct({
	type: Schema.Literal(4),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean),
});

const BooleanOption = Schema.Struct({
	type: Schema.Literal(5),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean),
});

const NumberOption = Schema.Struct({
	type: Schema.Literal(10),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean),
});

export const CommandOption = Schema.Union(
	StringOption,
	IntegerOption,
	BooleanOption,
	NumberOption,
);

export const SlashCommand = Schema.Struct({
	name: Schema.String,
	description: Schema.String,
	options: Schema.optional(Schema.Array(CommandOption)),
});

export type SlashCommand = Schema.Schema.Type<typeof SlashCommand>;

export const InteractionResponse = Schema.Struct({
	type: Schema.Number,
	data: Schema.optional(
		Schema.Struct({
			content: Schema.optional(Schema.String),
			embeds: Schema.optional(Schema.Array(Schema.Unknown)),
		}),
	),
});

export const InteractionOption = Schema.Struct({
	name: Schema.String,
	value: Schema.Unknown,
	type: Schema.optional(Schema.Number),
});

export const InteractionData = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	options: Schema.optional(Schema.Array(InteractionOption)),
});

export const Interaction = Schema.Struct({
	id: Schema.String,
	type: Schema.Number,
	data: InteractionData,
	guild_id: Schema.optional(Schema.String),
	channel_id: Schema.optional(Schema.String),
	token: Schema.String,
});

export type Interaction = Schema.Schema.Type<typeof Interaction>;
