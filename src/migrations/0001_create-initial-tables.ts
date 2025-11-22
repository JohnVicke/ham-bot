import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

export default Effect.flatMap(
	SqlClient.SqlClient,
	(sql) => sql`

CREATE TABLE users (
	id 					UUID 			 PRIMARY KEY DEFAULT uuidv7(),
  email 			TEXT 			 NOT NULL,
	external_id TEXT 			 NOT NULL,
  created_at 	TIMESTAMPZ NOT NULL DEFAULT now(),
  updated_at 	TIMESTAMPZ NOT NULL DEFAULT now()
	UNIQUE(external_id)
);
  `,
);
