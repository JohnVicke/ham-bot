import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { Config, Effect, Redacted, Schema } from "effect";

const StringOption = Schema.Struct({
	type: Schema.Literal(3),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean)
});

const IntegerOption = Schema.Struct({
	type: Schema.Literal(4),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean)
});

const BooleanOption = Schema.Struct({
	type: Schema.Literal(5),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean)
});

const NumberOption = Schema.Struct({
	type: Schema.Literal(10),
	name: Schema.String,
	description: Schema.String,
	required: Schema.optional(Schema.Boolean)
});

export const CommandOption = Schema.Union(
	StringOption,
	IntegerOption,
	BooleanOption,
	NumberOption
);

export const SlashCommand = Schema.Struct({
	name: Schema.String,
	description: Schema.String,
	options: Schema.optional(Schema.Array(CommandOption)),
})

export type SlashCommand = Schema.Schema.Type<typeof SlashCommand>;

export class EffectService extends Effect.Service<EffectService>()("EffectService", {
	dependencies: [FetchHttpClient.layer],
	effect: Effect.gen(function*() {
		const http = yield* HttpClient.HttpClient

		const token = yield* Config.redacted("DISCORD_BOT_TOKEN");
		const appId = yield* Config.string("DISCORD_APP_ID");

		const baseUrl = "https://dicord.com/api/v10";

		const client = http.pipe(
			HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
			HttpClient.mapRequest(HttpClientRequest.setHeader("Authorization", `Bot ${Redacted.value(token)}`)),
			HttpClient.mapRequest(HttpClientRequest.setHeader("Content-Type", "application/json")),
		)

		const syncCommands = Effect.fn(function*(commands: ReadonlyArray<SlashCommand>) {
			const encoded = yield* Schema.encode(Schema.Array(SlashCommand))(commands)

			const req = HttpClientRequest.put(`/applications/${appId}/commands`)


		})



		return {} as const;
	})
}) { }
