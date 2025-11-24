import { Effect, Schema, Stream } from "effect";
import { DiscordGatewayEventBus } from "./event-bus";
import { ChannelMessage, DeferredChannelMessage, DiscordHttp } from "./http";

const PingEvent = Schema.Struct({
	name: Schema.Literal("ping"),
});

const StatsEvent = Schema.Struct({
	name: Schema.Literal("stats"),
});

export class DiscordEventCoordinator extends Effect.Service<DiscordEventCoordinator>()(
	"DiscordEventCoordinator",
	{
		dependencies: [DiscordGatewayEventBus.Default, DiscordHttp.Default],
		effect: Effect.gen(function* () {
			const eventBus = yield* DiscordGatewayEventBus;
			const http = yield* DiscordHttp;

			const start = Effect.gen(function* () {
				const source = yield* Stream.fromPubSub(eventBus.pubsub).pipe(
					Stream.share({ capacity: "unbounded" }),
				);

				const logStream = source.pipe(Stream.tap((d) => Effect.log(d)));

				const pingStream = source.pipe(
					Stream.filter(({ d }) => Schema.is(PingEvent)(d.data)),
					Stream.tap(
						Effect.fn(function* ({ d }) {
							yield* http.respondToInteraction(
								new ChannelMessage({
									content: "Pong!",
									interactionId: d.id,
									token: d.token,
								}),
							);
						}),
					),
				);

				const statsEvent = source.pipe(
					Stream.filter(({ d }) => Schema.is(StatsEvent)(d.data)),
					Stream.tap(
						Effect.fn(function* ({ d }) {
							yield* http.respondToInteraction(
								new DeferredChannelMessage({
									interactionId: d.id,
									token: d.token,
								}),
							);

							yield* http.editOriginalInteraction(
								new ChannelMessage({
									content: "Here are your stats!",
									interactionId: d.id,
									token: d.token,
								}),
							);
						}),
					),
				);

				yield* Stream.merge(pingStream, statsEvent).pipe(
					Stream.merge(logStream),
					Stream.runDrain,
				);
			});

			return { start } as const;
		}),
	},
) {}
