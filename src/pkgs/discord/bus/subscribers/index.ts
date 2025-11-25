import { Effect, Layer } from "effect";
import { InteractionSubscriber } from "./interaction-subscriber";
import { ReadySubscriber } from "./ready-subscriber";

export namespace PubsubSubscribers {
	export const make = Effect.gen(function* () {
		yield* Effect.logInfo("Starting PubSubSubscribers");

		yield* Effect.acquireRelease(
			Effect.logInfo(`PubSubSubscribers started`),
			() => Effect.logInfo(`PubSubSubscribers stopped`),
		);
	});

	export const layer = Layer.scopedDiscard(make).pipe(
		Layer.provide(ReadySubscriber.layer),
		Layer.provide(InteractionSubscriber.layer),
	);
}
