import { Overlay } from "..";

export const closeOverlay = (overlay: Overlay): void => {
	if (overlay.state === Overlay.STATE.CLOSED) return;

	overlay.logger?.info("Closing");

	clearInterval(overlay.healthcheckInterval);
	clearInterval(overlay.pruneInterval);

	overlay.diceClient.events.removeListener("diceAddress", overlay.diceClientListeners.diceAddressListener);
	overlay.diceClient.events.removeListener("message", overlay.diceClientListeners.messageListener);

	overlay.events.removeListener("error", overlay.clientListeners.errorListener);
	overlay.events.removeListener("message", overlay.clientListeners.messageListener);

	overlay.diceClient.close();
	overlay.nodes.close();

	for (const { abort } of overlay.responseListenerMap.values()) abort.abort("close");
	overlay.responseListenerMap.clear();

	overlay.state = Overlay.STATE.CLOSED;
	overlay.events.emit("close");
	overlay.logger?.info("Closed");
};
