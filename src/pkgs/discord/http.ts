import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Config, Data, Effect, Redacted, Schema } from "effect";
import { SlashCommand } from "./schemas";

export class ChannelMessage extends Data.TaggedClass("ChannelMessage")<{
	token: string;
	interactionId: string;
	content: string;
}> {
	get body() {
		return {
			type: 4,
			data: { content: this.content },
		};
	}
}

export class DeferredChannelMessage extends Data.TaggedClass(
	"DeferredChannelMessage",
)<{
	token: string;
	interactionId: string;
}> {
	get body() {
		return {
			type: 5,
		};
	}
}

export class ModalMessage extends Data.TaggedClass("ModalMessage")<{
	token: string;
	interactionId: string;
}> {
	get body() {
		return {
			type: 9,
		};
	}
}

type InteractionMessage =
	| ChannelMessage
	| DeferredChannelMessage
	| ModalMessage;

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

		const respondToInteraction = Effect.fn(function* (
			message: InteractionMessage,
		) {
			yield* HttpClientRequest.post(
				`/interactions/${message.interactionId}/${message.token}/callback`,
			).pipe(
				HttpClientRequest.bodyJson(message.body),
				Effect.flatMap(client.execute),
			);
		});

		const editOriginalInteraction = Effect.fn(function* (
			message: ChannelMessage,
		) {
			yield* HttpClientRequest.patch(
				`/webhooks/${appId}/${message.token}/messages/@original`,
			).pipe(
				HttpClientRequest.bodyJson(message.body),
				Effect.flatMap(client.execute),
			);
		});

		const getWssUrl = Effect.fn(function* () {
			return yield* HttpClientRequest.get("/gateway").pipe(
				client.execute,
				Effect.flatMap(
					HttpClientResponse.schemaBodyJson(
						Schema.Struct({ url: Schema.String }),
					),
				),
				Effect.map((b) => b.url),
			);
		});

		return { syncCommands, respondToInteraction, editOriginalInteraction, getWssUrl } as const;
	}),
}) {}
