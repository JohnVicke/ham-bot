import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Config, Effect, Layer, pipe, Redacted } from "effect";

export namespace Otel {
	export const createService = Effect.fnUntraced(function* () {
		const apiToken = yield* Config.redacted("AXIOM_API_TOKEN");

		const version = yield* Config.withDefault(
			Config.string("GIT_COMMIT_SHA"),
			"unknown",
		);

		const gitBranch = yield* Config.withDefault(
			Config.string("GIT_COMMIT_REF"),
			"main",
		);

		const exporter = new OTLPTraceExporter({
			url: "https://api.axiom.co/v1/traces",
			headers: {
				Authorization: `Bearer ${Redacted.value(apiToken)}`,
				"X-Axiom-Dataset": "otel",
			},
			timeoutMillis: 250,
		});

		yield* Effect.addFinalizer(() =>
			pipe(
				Effect.tryPromise(() => {
					console.log("flushing spans");
					return exporter.forceFlush();
				}),
				Effect.catchAll(Effect.logError),
			),
		);

		return {
			resource: {
				serviceName: "ham-bot",
				serviceVersion: version,
				attributes: {
					gitBranch,
				},
			},
			spanProcessor: new BatchSpanProcessor(exporter),
		} as const satisfies NodeSdk.Configuration;
	});

	export const layer = NodeSdk.layer(createService()).pipe(
		Layer.provide(Layer.scope),
		Layer.orDie,
	);
}
