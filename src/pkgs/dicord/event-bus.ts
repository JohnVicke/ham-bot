import { Effect, PubSub } from "effect";
import type { GatewayEvent } from "./gateway";

export class DiscordGatewayEventBus extends Effect.Service<DiscordGatewayEventBus>()(
	"DiscordGatewayEventBus",
	{
		effect: Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<GatewayEvent>();

			const publish = (event: GatewayEvent) => PubSub.publish(pubsub, event);

			const subscribe = () => PubSub.subscribe(pubsub);

			return { publish, subscribe, pubsub } as const;
		}),
	},
) {}
