import { SqlClient, SqlSchema } from "@effect/sql";
import { Effect, Schema } from "effect";
import { PgLive } from "../pkgs/db";

export const PrincipalId = Schema.String.pipe(Schema.brand("PrincipalId"));

export class Principal extends Schema.Class<Principal>("Principal")({
	id: PrincipalId,
}) {}

export const UserId = Schema.UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export class User extends Schema.Class<User>("User")({
	id: UserId,
	email: Schema.String,
	externalId: PrincipalId,
	createdAt: Schema.DateTimeUtc,
	updatedAt: Schema.DateTimeUtc,
}) {}

const CreateUserInput = User.pipe(Schema.pick("externalId", "email"));

export class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
	dependencies: [PgLive],
	effect: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const create = SqlSchema.single({
			Result: User,
			Request: CreateUserInput,
			execute: (request) => sql`
				insert into 
					users ${sql.insert(request)}
					on conflict (external_id) do update
					set external_id = excluded.external_id -- no-op to trigger RETURNING	
				returning *
			`,
		});

		const findByPrincipalId = SqlSchema.single({
			Result: User,
			Request: PrincipalId,
			execute: (id) => sql`
				select * from users where external_id = ${id}
			`,
		});

		return { create, findByPrincipalId } as const;
	}),
}) {}
