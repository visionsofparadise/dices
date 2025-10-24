import { hex } from "@scure/base";
import { spawnIntegrationBootstrapClients as spawnIntegrationBootstrapDiceClients } from "@xkore/dice";
import { rmSync } from "fs";
import { Level } from "level";
import logger, { LogLevelNumbers } from "loglevel";
import { Overlay } from "../models/Overlay";

logger.setLevel(process.env.LOG_LEVEL ? (parseInt(process.env.LOG_LEVEL) as LogLevelNumbers) : 5);

export const spawnIntegrationBootstrapOverlays = async (options: Partial<Overlay.Options> | undefined, callback: (bootstrapOverlays: [Overlay, Overlay, Overlay]) => any): Promise<void> => {
	await spawnIntegrationBootstrapDiceClients(undefined, async (diceClients) => {
		const overlays: Array<Overlay> = [];

		for (const diceClient of diceClients) {
			const dbId = hex.encode(crypto.getRandomValues(new Uint8Array(16)));

			const database = new Level<Uint8Array, Uint8Array>(dbId, { keyEncoding: "view", valueEncoding: "view" });

			const overlay = new Overlay({
				bootstrapTargets: [],
				database,
				diceClient,
				logger,
				...options,
			});

			overlays.push(overlay);
		}

		for (const overlayA of overlays) {
			for (const overlayB of overlays) {
				overlayA.nodes.putNode(overlayB.node);
			}

			await overlayA.open(false);
			clearInterval(overlayA.healthcheckInterval);
			clearInterval(overlayA.pruneInterval);
		}

		try {
			await callback(overlays as [Overlay, Overlay, Overlay]);
		} finally {
			for (const overlay of overlays) {
				overlay.close();

				await overlay.database.close();
				rmSync(overlay.database.location, { recursive: true });
			}
		}
	});
};
