import { Effect, HashMap, Ref } from "effect";
import type { Command } from "./gateway";
import { DiscordHttp } from "./http";

export class DiscordCommandRegistry extends Effect.Service<DiscordCommandRegistry>()(
	"DiscordCommandRegistry",
	{
		dependencies: [DiscordHttp.Default],
		effect: Effect.gen(function* () {
			const commandsRef = yield* Ref.make(
				HashMap.empty<string, Command<any>>(),
			);
			const api = yield* DiscordHttp;

			const register = <Opts>(cmd: Command<Opts>) =>
				Ref.update(commandsRef, (cmds) =>
					HashMap.set(cmds, cmd.schema.name, cmd),
				);

			const get = (name: string) =>
				Effect.gen(function* () {
					const commands = yield* Ref.get(commandsRef);
					return HashMap.get(commands, name);
				});

			const syncWithDiscord = Effect.gen(function* () {
				const commands = yield* Ref.get(commandsRef);
				yield* api.syncCommands(
					HashMap.toValues(commands).map((s) => s.schema),
				);
				yield* Effect.log("Commands synced with Discord");
			});

			return { register, get, syncWithDiscord } as const;
		}),
	},
) {}
