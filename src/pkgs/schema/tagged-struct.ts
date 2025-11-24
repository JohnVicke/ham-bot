import { Schema, type SchemaAST } from "effect";

/**
 * @description
 * Schema.TaggedStruct does not automatically add a `_tag` field
 * during decoding, so this utility function creates a tagged struct schema
 * with a `_tag` field that is set to the provided tag value.
 */
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
