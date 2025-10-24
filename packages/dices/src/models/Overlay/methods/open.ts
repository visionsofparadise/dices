import { Overlay } from "..";
import { Value } from "../../Value";

export const openOverlay = async (overlay: Overlay, isBootstrapping = true): Promise<void> => {
	if (overlay.state === Overlay.STATE.OPENED) return;

	overlay.logger?.info("Opening");

	await overlay.database.open();

	overlay.diceClient.events.on("diceAddress", overlay.diceClientListeners.diceAddressListener);
	overlay.diceClient.events.on("message", overlay.diceClientListeners.messageListener);
	await overlay.diceClient.open(isBootstrapping);

	overlay.events.on("error", overlay.clientListeners.errorListener);
	overlay.events.on("message", overlay.clientListeners.messageListener);

	overlay.currentRatchetKeys = await overlay.loadRatchetKeys();
	overlay.value = Value.create(
		{
			initiationKeys: overlay.currentRatchetKeys,
		},
		overlay.keys
	);

	overlay.healthcheckInterval = setInterval(() => overlay.healthcheck(), overlay.options.healthcheckIntervalMs);
	overlay.pruneInterval = setInterval(() => overlay.prune(), overlay.options.pruneIntervalMs);

	overlay.state = Overlay.STATE.OPENED;
	overlay.events.emit("open");
	overlay.logger?.info("Open");

	if (isBootstrapping) {
		await overlay.healthcheck();
	}
};
