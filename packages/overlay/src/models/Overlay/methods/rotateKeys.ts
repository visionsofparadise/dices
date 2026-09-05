import type { Overlay } from "..";
import { RatchetKeysItem } from "../../RatchetKeysItem";
import { Value } from "../../Value";

export const rotateOverlayKeys = async (overlay: Overlay): Promise<void> => {
	// Capture old keys to prevent race condition
	const oldKeys = overlay.currentRatchetKeys;
	const newKeys = new RatchetKeysItem();

	if (oldKeys) {
		oldKeys.rotatedAt = Date.now();
		await oldKeys.put(overlay);
	}

	await newKeys.put(overlay);

	overlay.currentRatchetKeys = newKeys;
	overlay.value = Value.create(
		{
			initiationKeys: newKeys,
		},
		overlay.keys
	);
	overlay.events.emit("rotate", newKeys);
};
