import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Config, Effect, Redacted, Schema } from "effect";
import {
	type ChannelMessage,
	type DeferredChannelMessage,
	type DirectChannelMessage,
	type ModalMessage,
	SlashCommand,
} from "./schemas";

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

		const sendChannelMessage = Effect.fn(function* (
			message: DirectChannelMessage,
		) {
			yield* HttpClientRequest.post(
				`/channels/${message.channelId}/messages`,
			).pipe(
				HttpClientRequest.bodyJson(message.body),
				Effect.flatMap(client.execute),
			);
		});

		const getGuildChannels = Effect.fn(function* (guildId: string) {
			return yield* HttpClientRequest.get(`/guilds/${guildId}/channels`).pipe(
				client.execute,
				Effect.flatMap(
					HttpClientResponse.schemaBodyJson(
						Schema.Array(
							Schema.Struct({
								id: Schema.String,
								name: Schema.String,
								type: Schema.Number,
							}),
						),
					),
				),
			);
		});

		const createChannel = Effect.fn(function* (
			guildId: string,
			name: string,
			type: number = 0, // 0 = text channel
		) {
			return yield* HttpClientRequest.post(`/guilds/${guildId}/channels`).pipe(
				HttpClientRequest.bodyJson({ name, type }),
				Effect.flatMap(client.execute),
				Effect.flatMap(
					HttpClientResponse.schemaBodyJson(
						Schema.Struct({
							id: Schema.String,
							name: Schema.String,
							type: Schema.Number,
						}),
					),
				),
			);
		});

		return {
			createChannel,
			getGuildChannels,
			sendChannelMessage,
			syncCommands,
			respondToInteraction,
			editOriginalInteraction,
			getWssUrl,
		} as const;
	}),
}) {}
