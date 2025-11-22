import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Config, Effect, Redacted, Schema } from "effect";
import { InteractionResponse, SlashCommand } from "./schemas";

export class DiscordApi extends Effect.Service<DiscordApi>()("DiscordApi", {
	dependencies: [FetchHttpClient.layer],
	effect: Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;

		const token = yield* Config.redacted("DISCORD_TOKEN");
		const appId = yield* Config.string("DISCORD_APP_ID");

		const baseUrl = "https://dicord.com/api/v10";

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

		return { syncCommands, respondToInteraction } as const;
	}),
}) {}
