import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { PgMigrator } from "@effect/sql-pg";
import { Array as Arr, Effect } from "effect";
import { PgLive } from "../pkgs/db";

BunRuntime.runMain(
	Effect.gen(function* () {
		const migrations = yield* PgMigrator.run({
			loader: PgMigrator.fromFileSystem(
				path.join(
					fileURLToPath(new URL(".", import.meta.url)),
					"../migrations",
				),
			),
			schemaDirectory: path.join(
				fileURLToPath(new URL(".", import.meta.url)),
				"../migrations/sql",
			),
		});

		yield* Arr.match(migrations, {
			onEmpty: () => Effect.log("No new migrations to run."),
			onNonEmpty: (migrations) =>
				Effect.gen(function* () {
					yield* Effect.log("Migrations applied:");
					for (const [id, name] of migrations) {
						yield* Effect.log(`- ${id.toString().padStart(4, "0")}_${name}`);
					}
				}),
		});
	}).pipe(Effect.provide([BunContext.layer, PgLive])),
);
