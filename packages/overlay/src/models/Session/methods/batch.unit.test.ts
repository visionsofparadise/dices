import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { rmSync } from "fs";
import { Level } from "level";
import { Session } from "../index.js";
import { Overlay } from "../../Overlay/index.js";
import { Client as DiceClient } from "@xkore/dice";
import { RatchetStateItem } from "../../RatchetStateItem/index.js";
import { KeyChain } from "../../KeyChain/index.js";
import { RootChain } from "../../RootChain/index.js";

describe("Session batch mode", () => {
	let database: Level<Uint8Array, Uint8Array>;
	let overlay: Overlay;
	let remoteNodeId: Uint8Array;
	let session: Session;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = `./test-db-session-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		database = new Level(dbPath, { valueEncoding: "view" });
		await database.open();

		const diceClient = new DiceClient({
			secretKey: new Uint8Array(32).fill(1),
		});

		overlay = new Overlay({
			database,
			diceClient,
			secretKey: new Uint8Array(32).fill(2),
		});

		remoteNodeId = new Uint8Array(20).fill(3);
		session = new Session(overlay, remoteNodeId);
	});

	afterEach(async () => {
		if (database) {
			await database.close();
			rmSync(dbPath, { recursive: true, force: true });
		}
	});

	it("should start batch mode successfully", () => {
		expect(session.isInBatch).toBe(false);
		expect(session.batchSnapshot).toBeUndefined();

		session.startBatch();

		expect(session.isInBatch).toBe(true);
		expect(session.batchSnapshot).toBeUndefined(); // No state yet
	});

	it("should throw error when starting batch twice", () => {
		session.startBatch();

		expect(() => session.startBatch()).toThrow("Already in batch mode");
	});

	it("should snapshot state when batch started with existing ratchetState", () => {
		// Create a properly initialized ratchet state
		const rootChain = new RootChain({
			rootKey: new Uint8Array(32),
			dhSecretKey: new Uint8Array(32),
			remoteDhPublicKey: new Uint8Array(32),
			sendingChain: new KeyChain({ chainKey: new Uint8Array(32), messageNumber: 0 }),
			receivingChain: new KeyChain({ chainKey: new Uint8Array(32), messageNumber: 0 }),
		});

		const ratchetState = new RatchetStateItem({
			indexKey: RatchetStateItem.INDEX_KEY,
			ratchetId: session.ratchetId,
			rootChain,
			previousChainLength: 0,
			skippedKeys: [],
			ratchetAt: Date.now(),
			remoteKeyId: new Uint8Array(8),
		});

		session.ratchetState = ratchetState;

		session.startBatch();

		expect(session.isInBatch).toBe(true);
		expect(session.batchSnapshot).toBeInstanceOf(Uint8Array);
		expect(session.batchSnapshot!.byteLength).toBeGreaterThan(0);
	});

	it("should end batch mode and clear snapshot", async () => {
		session.startBatch();
		session.isInBatch = true;

		await session.endBatch();

		expect(session.isInBatch).toBe(false);
		expect(session.batchSnapshot).toBeUndefined();
	});

	it("should cancel batch and restore from snapshot", () => {
		// Create initial state with proper 32-byte chainKeys
		const chainKey = new Uint8Array(32);
		for (let i = 0; i < 32; i++) chainKey[i] = i; // Fill with test values

		const initialRootChain = new RootChain({
			rootKey: new Uint8Array(32).fill(1),
			dhSecretKey: new Uint8Array(32).fill(2),
			remoteDhPublicKey: new Uint8Array(32).fill(3),
			sendingChain: new KeyChain({ chainKey: chainKey.slice(), messageNumber: 0 }),
			receivingChain: new KeyChain({ chainKey: chainKey.slice(), messageNumber: 0 }),
		});

		const initialState = new RatchetStateItem({
			indexKey: RatchetStateItem.INDEX_KEY,
			ratchetId: session.ratchetId,
			rootChain: initialRootChain,
			previousChainLength: 0,
			skippedKeys: [],
			ratchetAt: Date.now(),
			remoteKeyId: new Uint8Array(8).fill(4),
		});

		session.ratchetState = initialState;

		// Snapshot the current state
		session.startBatch();

		const originalPreviousChainLength = session.ratchetState.previousChainLength;

		// Modify state (without calling next() which changes chainKey)
		session.ratchetState.previousChainLength = 42;
		session.isDirty = true;

		expect(session.ratchetState.previousChainLength).toBe(42);

		// Cancel should restore original
		session.cancelBatch();

		expect(session.isInBatch).toBe(false);
		expect(session.isDirty).toBe(false);
		expect(session.batchSnapshot).toBeUndefined();
		expect(session.ratchetState!.previousChainLength).toBe(originalPreviousChainLength);
	});

	it("should not save during batch mode operations", async () => {
		session.startBatch();
		session.isDirty = true;

		// In batch mode, dirty flag stays until endBatch
		expect(session.isDirty).toBe(true);
	});

	it("should save on endBatch if dirty", async () => {
		const rootChain = new RootChain({
			rootKey: new Uint8Array(32),
			dhSecretKey: new Uint8Array(32),
			remoteDhPublicKey: new Uint8Array(32),
			sendingChain: new KeyChain({ chainKey: new Uint8Array(32), messageNumber: 0 }),
			receivingChain: new KeyChain({ chainKey: new Uint8Array(32), messageNumber: 0 }),
		});

		const ratchetState = new RatchetStateItem({
			indexKey: RatchetStateItem.INDEX_KEY,
			ratchetId: session.ratchetId,
			rootChain,
			previousChainLength: 0,
			skippedKeys: [],
			ratchetAt: Date.now(),
			remoteKeyId: new Uint8Array(8),
		});

		session.ratchetState = ratchetState;
		session.isDirty = true;
		session.startBatch();

		await session.endBatch();

		expect(session.isDirty).toBe(false);
	});

	it("should handle close during batch mode", async () => {
		const rootChain = new RootChain({
			rootKey: new Uint8Array(32),
			dhSecretKey: new Uint8Array(32),
			remoteDhPublicKey: new Uint8Array(32),
			sendingChain: new KeyChain({ chainKey: new Uint8Array(32), messageNumber: 0 }),
			receivingChain: new KeyChain({ chainKey: new Uint8Array(32), messageNumber: 0 }),
		});

		const ratchetState = new RatchetStateItem({
			indexKey: RatchetStateItem.INDEX_KEY,
			ratchetId: session.ratchetId,
			rootChain,
			previousChainLength: 0,
			skippedKeys: [],
			ratchetAt: Date.now(),
			remoteKeyId: new Uint8Array(8),
		});

		session.ratchetState = ratchetState;
		session.startBatch();
		session.isDirty = true;

		await session.close();

		expect(session.isDirty).toBe(false);
		expect(session.isInBatch).toBe(false);
		expect(session.batchSnapshot).toBeUndefined();
	});
});
