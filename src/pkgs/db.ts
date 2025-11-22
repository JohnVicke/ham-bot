import { PgClient } from "@effect/sql-pg";
import {
	Config,
	Duration,
	Effect,
	Function as Func,
	Layer,
	Schedule,
	String as Str,
} from "effect";

export const pgConfig = {
	transformQueryNames: Str.camelToSnake,
	transformResultNames: Str.snakeToCamel,
	// - 114: JSON (return as string instead of parsed object)
	// - 1082: DATE
	// - 1114: TIMESTAMP WITHOUT TIME ZONE
	// - 1184: TIMESTAMP WITH TIME ZONE
	// - 3802: JSONB (return as string instead of parsed object)
	types: {
		114: {
			to: 25,
			from: [114],
			parse: Func.identity,
			serialize: Func.identity,
		},
		1082: {
			to: 25,
			from: [1082],
			parse: Func.identity,
			serialize: Func.identity,
		},
		1114: {
			to: 25,
			from: [1114],
			parse: Func.identity,
			serialize: Func.identity,
		},
		1184: {
			to: 25,
			from: [1184],
			parse: Func.identity,
			serialize: Func.identity,
		},
		3802: {
			to: 25,
			from: [3802],
			parse: Func.identity,
			serialize: Func.identity,
		},
	},
} satisfies PgClient.PgClientConfig;

export const PgLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		console.log(process.env.DATABASE_URL);
		return PgClient.layer({
			url: yield* Config.redacted("DATABASE_URL"),
			...pgConfig,
		});
	}),
).pipe((self) =>
	Layer.retry(
		self,
		Schedule.identity<Layer.Layer.Error<typeof self>>().pipe(
			Schedule.check((input) => input._tag === "SqlError"),
			Schedule.intersect(Schedule.exponential("1 second")),
			Schedule.intersect(Schedule.recurs(2)),
			Schedule.onDecision(([[_error, duration], attempt], decision) =>
				decision._tag === "Continue"
					? Effect.logInfo(
							`Retrying database connection in ${Duration.format(duration)} (attempt #${++attempt})`,
						)
					: Effect.void,
			),
		),
	),
);
