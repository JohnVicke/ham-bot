import { Effect, Layer, Stream } from "effect";
import type { GatewayEventTypeToEvent } from "../../gateway";
import { DiscordGatewayEventBus } from "../event-bus";

export namespace InteractionSubscriber {
	export const make = Effect.gen(function* () {
		const bus = yield* DiscordGatewayEventBus;

		const stream = yield* bus.streamFor("InteractionCreate");

		const handler = Effect.fn(function* (
			m: GatewayEventTypeToEvent["InteractionCreate"],
		) {
			yield* Effect.logInfo("Interaction received");
		});

		yield* Effect.forkScoped(stream.pipe(Stream.tap(handler), Stream.runDrain));
	});

	export const layer = Layer.scopedDiscard(make).pipe(
		Layer.provide(DiscordGatewayEventBus.Default),
	);
}
