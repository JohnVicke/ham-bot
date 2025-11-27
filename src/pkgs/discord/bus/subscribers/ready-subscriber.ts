import { Array as Arr, Effect, Layer, Option, Stream } from "effect";
import { DiscordHttp } from "../../http";
import type { GatewayEventTypeToEvent } from "../../schemas";
import { DiscordGatewayEventBus } from "../event-bus";

export namespace ReadySubscriber {
	export const make = Effect.gen(function* () {
		const bus = yield* DiscordGatewayEventBus;
		const http = yield* DiscordHttp;

		const stream = yield* bus.streamFor("Ready");

		const ensurePubgChannel = Effect.fn(function* (guildId: string) {
			const channels = yield* http.getGuildChannels(guildId);
			const existingChannel = Arr.findFirst(
				channels,
				(channel) => channel.name === "pubg" && channel.type === 0,
			);

			const channelId = yield* Option.match(existingChannel, {
				onNone: () =>
					Effect.gen(function* () {
						const newChannel = yield* http.createChannel(guildId, "pubg", 0);
						yield* Effect.logInfo(
							`Created new channel 'pubg' with ID: ${newChannel.id}`,
						);
						return newChannel.id;
					}),
				onSome: (channel) => Effect.succeed(channel.id),
			});

			yield* http.sendChannelMessage({
				channelId,
				body: {
					content: "PUBG channel is ready! 🎮",
					embeds: [],
				},
			});

			yield* Effect.logInfo(`Message sent to pubg channel: ${channelId}`);
		});

		const handler = Effect.fn(function* (m: GatewayEventTypeToEvent["Ready"]) {
			yield* Effect.logInfo(`Received Ready event for user`);

			// Process all guilds
			yield* Effect.forEach(
				m.d.guilds,
				(guild) =>
					ensurePubgChannel(guild.id).pipe(
						Effect.catchAll((error) =>
							Effect.logError(
								`Failed to setup pubg channel for guild ${guild.id}`,
								error,
							),
						),
					),
				{ concurrency: "unbounded" },
			);
		});

		yield* Effect.forkScoped(stream.pipe(Stream.tap(handler), Stream.runDrain));
	});

	export const layer = Layer.scopedDiscard(make).pipe(
		Layer.provide([DiscordGatewayEventBus.Default, DiscordHttp.Default]),
	);
}
