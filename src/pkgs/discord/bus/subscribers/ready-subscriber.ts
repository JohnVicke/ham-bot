import { Effect, Layer, Stream } from "effect";
import type { GatewayEventTypeToEvent } from "../../gateway";
import { DiscordGatewayEventBus } from "../event-bus";

export namespace ReadySubscriber {
	export const make = Effect.gen(function* () {
		const bus = yield* DiscordGatewayEventBus;

		const stream = yield* bus.streamFor("Ready");

		const handler = Effect.fn(function* (m: GatewayEventTypeToEvent["Ready"]) {
			yield* Effect.logInfo(`Received Ready event for user`);
		});

		yield* Effect.forkScoped(stream.pipe(Stream.tap(handler), Stream.runDrain));
	});

	export const layer = Layer.scopedDiscard(make).pipe(
		Layer.provide(DiscordGatewayEventBus.Default),
	);
}
