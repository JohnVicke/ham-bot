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
