import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import {
	Config,
	Duration,
	Effect,
	Option,
	Redacted,
	Schedule,
	Schema,
} from "effect";

const PlayerStats = Schema.Struct({
	assists: Schema.Number,
	boosts: Schema.Number,
	dBNOs: Schema.Number,
	dailyKills: Schema.Number,
	dailyWins: Schema.Number,
	damageDealt: Schema.Number,
	days: Schema.Number,
	headshotKills: Schema.Number,
	heals: Schema.Number,
	killPoints: Schema.Number,
	kills: Schema.Number,
	longestKill: Schema.Number,
	longestTimeSurvived: Schema.Number,
	losses: Schema.Number,
	maxKillStreaks: Schema.Number,
	mostSurvivalTime: Schema.Number,
	rankPoints: Schema.Number,
	rankPointsTitle: Schema.Union(Schema.Number, Schema.String),
	revives: Schema.Number,
	rideDistance: Schema.Number,
	roadKills: Schema.Number,
	roundMostKills: Schema.Number,
	roundsPlayed: Schema.Number,
	suicides: Schema.Number,
	swimDistance: Schema.Number,
	teamKills: Schema.Number,
	timeSurvived: Schema.Number,
	top10s: Schema.Number,
	vehicleDestroys: Schema.Number,
	walkDistance: Schema.Number,
	weaponsAcquired: Schema.Number,
	weeklyKills: Schema.Number,
	weeklyWins: Schema.Number,
	winPoints: Schema.Number,
	wins: Schema.Number,
});

const Player = Schema.Struct({
	type: Schema.Literal("player"),
	id: Schema.String,
	attributes: Schema.Struct({
		name: Schema.String,
		shardId: Schema.String,
		stats: Schema.Unknown, // Will be null in player search
	}),
	relationships: Schema.Struct({
		matches: Schema.Struct({
			data: Schema.Array(
				Schema.Struct({
					type: Schema.Literal("match"),
					id: Schema.String,
				}),
			),
		}),
	}),
});

const SeasonStats = Schema.Struct({
	type: Schema.Literal("playerSeason"),
	attributes: Schema.Struct({
		gameModeStats: Schema.Record({
			key: Schema.Union(
				Schema.Literal("solo"),
				Schema.Literal("duo"),
				Schema.Literal("squad"),
				Schema.Literal("solo-fpp"),
				Schema.Literal("duo-fpp"),
				Schema.Literal("squad-fpp"),
			),
			value: PlayerStats,
		}),
	}),
});

const Participant = Schema.Struct({
	type: Schema.Literal("participant"),
	id: Schema.String,
	attributes: Schema.Struct({
		stats: Schema.Struct({
			name: Schema.String,
			playerId: Schema.String,
			kills: Schema.Number,
			damageDealt: Schema.Number,
			timeSurvived: Schema.Number,
			winPlace: Schema.Number,
			deathType: Schema.String,
			DBNOs: Schema.Number,
			headshotKills: Schema.Number,
		}),
	}),
});

const Match = Schema.Struct({
	type: Schema.Literal("match"),
	id: Schema.String,
	attributes: Schema.Struct({
		duration: Schema.Number,
		gameMode: Schema.String,
		mapName: Schema.String,
		isCustomMatch: Schema.Boolean,
		createdAt: Schema.String,
	}),
});

export class PubgApi extends Effect.Service<PubgApi>()("PubgApi", {
	dependencies: [FetchHttpClient.layer],
	effect: Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;
		const apiKey = yield* Config.redacted("PUBG_API_KEY");

		const platform = yield* Config.withDefault(
			Config.string("PUBG_PLATFORM"),
			"steam",
		);

		const baseUrl = "https://api.pubg.com";

		const client = http.pipe(
			HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
			HttpClient.mapRequest(
				HttpClientRequest.setHeader(
					"Authorization",
					`Bearer ${Redacted.value(apiKey)}`,
				),
			),
			HttpClient.mapRequest(
				HttpClientRequest.setHeader("accept", "application/vnd.api+json"),
			),
			HttpClient.retry({
				schedule: Schedule.exponential(Duration.seconds(1)),
				times: 3,
			}),
		);

		const findPlayerByName = Effect.fn(function* (playerName: string) {
			const response = yield* HttpClientRequest.get(
				`/shards/${platform}/players`,
			).pipe(
				HttpClientRequest.setUrlParam("filter[playerNames]", playerName),
				client.execute,
				Effect.flatMap(
					HttpClientResponse.schemaBodyJson(
						Schema.Struct({
							data: Schema.Array(Player),
						}),
					),
				),
			);

			return Option.fromNullable(response.data.at(0));
		});

		const getSeasonStats = (playerId: string, seasonId = "lifetime") =>
			HttpClientRequest.get(
				`/shards/${platform}/players/${playerId}/seasons/${seasonId}`,
			).pipe(
				client.execute,
				Effect.flatMap(
					HttpClientResponse.schemaBodyJson(
						Schema.Struct({
							data: SeasonStats,
						}),
					),
				),
				Effect.map((res) => res.data.attributes.gameModeStats["squad-fpp"]),
			);

		return { findPlayerByName, getSeasonStats } as const;
	}),
}) {}
