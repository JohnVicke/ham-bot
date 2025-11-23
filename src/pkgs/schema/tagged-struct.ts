import { Schema, type SchemaAST } from "effect";

export const TaggedStruct = <
	Tag extends SchemaAST.LiteralValue,
	Fields extends Schema.Struct.Fields,
>(
	tag: Tag,

	fields: Fields,
) =>
	Schema.Struct({
		_tag: Schema.Literal(tag).pipe(
			Schema.optional,
			Schema.withDefaults({
				constructor: () => tag,
				decoding: () => tag,
			}),
		),
		...fields,
	});
