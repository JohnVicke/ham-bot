import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Config, Effect, Redacted, Schema } from "effect";
import { SlashCommand } from "./schemas";

export class DiscordHttp extends Effect.Service<DiscordHttp>()("DiscordHttp", {
	dependencies: [FetchHttpClient.layer],
	effect: Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;

		const token = yield* Config.redacted("DISCORD_TOKEN");
		const appId = yield* Config.string("DISCORD_APP_ID");

		const baseUrl = "https://discord.com/api/v10";

		const client = http.pipe(
			HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
			HttpClient.mapRequest(
				HttpClientRequest.setHeader(
					"Authorization",
					`Bot ${Redacted.value(token)}`,
				),
			),
			HttpClient.mapRequest(HttpClientRequest.acceptJson),
		);

		const syncCommands = Effect.fn(function* (
			commands: ReadonlyArray<SlashCommand>,
		) {
			const req = yield* HttpClientRequest.put(
				`/applications/${appId}/commands`,
			).pipe(
				HttpClientRequest.schemaBodyJson(Schema.Array(SlashCommand))(commands),
			);
			yield* client.execute(req);
		});

		const respondToInteraction = Effect.fn(function* (args: {
			content: string;
			token: string;
			interactionId: string;
		}) {
			const res = yield* HttpClientRequest.post(
				`/interactions/${args.interactionId}/${args.token}/callback`,
			).pipe(
				HttpClientRequest.bodyJson({
					type: 4,
					data: { content: args.content },
				}),
				Effect.flatMap(client.execute),
			);

			console.log(res.status);
		});

		const getWssUrl = Effect.fn(function* () {
			return yield* HttpClientRequest.get("/gateway").pipe(
				client.execute,
				Effect.flatMap(
					HttpClientResponse.schemaBodyJson(
						Schema.Struct({ url: Schema.String }),
					),
				),
				Effect.map((b) => b.url)
			);
		});

		return { syncCommands, respondToInteraction, getWssUrl } as const;
	}),
}) {}
