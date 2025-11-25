import { Effect, PubSub, Stream } from "effect";
import type { GatewayEvent, GatewayEventTypeToEvent } from "../gateway";

export class DiscordGatewayEventBus extends Effect.Service<DiscordGatewayEventBus>()(
	"DiscordGatewayEventBus",
	{
		effect: Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<GatewayEvent>().pipe(
				Effect.tap(() => Effect.logDebug("PubSub created")),
			);

			const publish = (event: GatewayEvent) => PubSub.publish(pubsub, event);

			const subscribe = () => PubSub.subscribe(pubsub);

			const streamFor = Effect.fn(function* <T extends GatewayEvent["_tag"]>(
				event: T,
			) {
				const source = yield* Stream.fromPubSub(pubsub).pipe(
					Stream.share({ capacity: "unbounded" }),
				);

				function predicate(e: GatewayEvent): e is GatewayEventTypeToEvent[T] {
					return e._tag === event;
				}

				return source.pipe(Stream.filter(predicate));
			});

			return { publish, subscribe, pubsub, streamFor } as const;
		}),
	},
) {}
