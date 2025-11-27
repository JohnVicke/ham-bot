import { Schema } from "effect";

export class EmbedField extends Schema.Class<EmbedField>("EmbedField")({
	name: Schema.String,
	value: Schema.String,
	inline: Schema.optional(Schema.Boolean),
}) {}

export class EmbedAuthor extends Schema.Class<EmbedAuthor>("EmbedAuthor")({
	name: Schema.String,
	url: Schema.optional(Schema.String),
	icon_url: Schema.optional(Schema.String),
}) {}

export class EmbedFooter extends Schema.Class<EmbedFooter>("EmbedFooter")({
	text: Schema.String,
	icon_url: Schema.optional(Schema.String),
}) {}

export class EmbedImage extends Schema.Class<EmbedImage>("EmbedImage")({
	url: Schema.String,
}) {}

export class Embed extends Schema.Class<Embed>("Embed")({
	title: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
	color: Schema.optional(Schema.Number),
	fields: Schema.optional(Schema.Array(EmbedField)),
	thumbnail: Schema.optional(EmbedImage),
	image: Schema.optional(EmbedImage),
	footer: Schema.optional(EmbedFooter),
	timestamp: Schema.optional(Schema.String),
	author: Schema.optional(EmbedAuthor),
	url: Schema.optional(Schema.String),
}) {}

export class ChannelMessage extends Schema.Class<ChannelMessage>(
	"ChannelMessage",
)({
	token: Schema.String,
	interactionId: Schema.String,
	content: Schema.optional(Schema.String),
	embeds: Schema.optional(Schema.Array(Embed)),
}) {
	get body() {
		return {
			type: 4,
			data: {
				content: this.content,
				embeds: this.embeds,
			},
		};
	}
}

export class DirectChannelMessage extends Schema.Class<DirectChannelMessage>(
	"DirectChannelMessage",
)({
	channelId: Schema.String,
	content: Schema.optional(Schema.String),
	embeds: Schema.optional(Schema.Array(Embed)),
}) {
	get body() {
		return {
			content: this.content,
			embeds: this.embeds,
		};
	}
}

export class DeferredChannelMessage extends Schema.Class<DeferredChannelMessage>(
	"DeferredChannelMessage",
)({
	token: Schema.String,
	interactionId: Schema.String,
}) {
	get body() {
		return {
			type: 5,
		};
	}
}

export class ModalMessage extends Schema.Class<ModalMessage>("ModalMessage")({
	token: Schema.String,
	interactionId: Schema.String,
}) {
	get body() {
		return {
			type: 9,
		};
	}
}
