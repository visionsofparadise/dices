import { base32crockford } from "@scure/base";
import { SendClientAddressOptions } from "@xkore/dice";
import { Overlay } from "..";
import { DicesOverlayError } from "../../Error";
import type { Target } from "../../Target/Codec";

export const sendOverlay = async (overlay: Overlay, target: Target, buffer: Uint8Array, options?: SendClientAddressOptions): Promise<void> => {
	if (overlay.state !== Overlay.STATE.OPENED) throw new DicesOverlayError("Overlay is closed");

	overlay.logger?.debug(`Sending message ${buffer.byteLength} bytes to ${base32crockford.encode(target.nodeId)}`);


	// DiceAddress is a composite with ipv6 and ipv4 properties, not a typed address
	// Try IPv6 first, then IPv4
	const ipv6Overlay = overlay.diceClient.overlays.ipv6;
	const ipv4Overlay = overlay.diceClient.overlays.ipv4;

	if (ipv6Overlay && target.diceAddress.ipv6) {
		await ipv6Overlay.send(target.diceAddress.ipv6.address, buffer, options);
	} else if (ipv4Overlay && target.diceAddress.ipv4) {
		await ipv4Overlay.send(target.diceAddress.ipv4.address, buffer, options);
	} else {
		throw new DicesOverlayError("No valid address found in target diceAddress");
	}

};
