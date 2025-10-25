# @xkore/dices

Transport-agnostic quantum-resistant encryption layer for P2P applications using bounded triple ratchet (ML-KEM-1024 + X25519 + XChaCha20-Poly1305) encryption.

**In plain English:** DICES scrambles your messages so only the intended recipient can read them, using encryption that stays secure even against future quantum computers. Every message automatically updates the encryption keys - if someone steals today's keys, they can't read yesterday's messages (forward secrecy) or tomorrow's messages (backward secrecy).

## What is DICES?

DICES provides end-to-end encryption for P2P applications that remains secure even against future quantum computers. It uses a **triple ratchet** system (combining three types of key updates) to ensure:

- **Forward secrecy**: Past messages stay secret even if current keys are compromised
- **Backward secrecy**: Future messages stay secret even if past keys were compromised
- **Quantum resistance**: Protection against attacks by quantum computers using ML-KEM-1024

In an overlay network, nodes publish their public encryption keys to a DHT (distributed hash table). Once you know another node's ID, you can automatically discover their keys and establish an encrypted channel - no central server or pre-shared secrets required.

[See detailed cryptography explanation below](#cryptography)

## Features

- **Quantum-resistant encryption**: ML-KEM-1024 (NIST FIPS 203) + X25519 hybrid approach
- **Forward and backward secrecy**: Bounded triple ratchet with configurable message/time limits
- **Transport-agnostic**: Works over any transport layer (UDP, TCP, WebRTC, etc.)
- **DHT key discovery**: Automatic peer initiation key lookup via DICE protocol

## Installation

```bash
npm install @xkore/dices
```

## Quick Start

### 1. Opening the Overlay

```typescript
import { Overlay } from "@xkore/dices";
import { Client as DiceClient } from "@xkore/dice";
import { Level } from "level";

// Create and open overlay instance
const overlay = new Overlay({
	database: new Level("./db"),
	diceClient: new DiceClient({
		/* ... */
	}),
	secretKey: mySecretKey, // optional, generates random if omitted
});

await overlay.open();
// Overlay is now connected to the DHT and has published its initiation keys
```

### 2. Encrypting and Decrypting Messages

```typescript
import { wrap, unwrap } from "@xkore/dices";

// Encrypt message for Bob (automatically fetches his initiation keys from DHT)
const envelope = await wrap(bobNodeId, messageData, overlay);

// envelope.buffer is a Uint8Array - send it via YOUR transport layer
// (UDP, TCP, WebRTC, WebSocket, carrier pigeon, etc.)
// Example: await yourTransport.send(bobAddress, envelope.buffer);

// When you receive an envelope buffer from your transport:
// yourTransport.on("message", async (buffer, sender) => {
// unwrap can accept either a buffer or Envelope instance
const data = await unwrap(buffer, overlay);
console.log("Received message:", data);
// });
```

### 3. Closing the Overlay

```typescript
// Cleanup resources when done
await overlay.close();
```

## Core API

### Overlay Constructor

Creates a new DICES overlay instance for quantum-resistant encrypted P2P communication.

```typescript
const overlay = new Overlay(options);
```

**Options:**

- `database` (required): LevelDB instance for persistent ratchet state storage
- `diceClient` (required): DICE client instance for DHT operations and peer discovery
- `secretKey` (optional): 32-byte secp256k1 secret key (generates random if not provided)
- `bootstrapTargets` (optional): Initial DHT nodes to connect to (defaults to built-in bootstrap nodes)
- `concurrency` (optional): Number of concurrent DHT operations (default: 3)
- `healthcheckIntervalMs` (optional): Interval for DHT healthchecks in ms (default: 60000)
- `pruneIntervalMs` (optional): Interval for cleaning expired ratchet state in ms (default: 3600000)
- `ratchetKeyTtl` (optional): Time-to-live for ratchet keys in ms (default: 3600000)
- `timeoutMs` (optional): Default timeout for operations in ms (default: 30000)

**Example:**

```typescript
import { Level } from "level";
import { Client as DiceClient } from "@xkore/dice";

const overlay = new Overlay({
	database: new Level("./my-app-db"),
	diceClient: new DiceClient({
		secretKey: myDiceSecretKey,
		// ... other DICE options
	}),
	secretKey: myOverlaySecretKey,
	healthcheckIntervalMs: 30000, // 30 seconds
	timeoutMs: 10000, // 10 second timeout
});
```

### open()

Opens the overlay and starts network operations.

```typescript
await overlay.open(isBootstrapping?: boolean);
```

Opens the database, connects the DICE client to the network, loads or generates ratchet keys, publishes initiation keys to the DHT, and starts healthcheck and prune intervals.

**Parameters:**

- `isBootstrapping` (optional): Whether to connect to bootstrap nodes (default: `true`)

**Returns:** `Promise<void>`

**Example:**

```typescript
// Open with bootstrapping (default)
await overlay.open();

// Open without bootstrapping (already connected to DHT)
await overlay.open(false);

// Overlay is now ready for encrypted communication
```

### wrap()

Wraps (encrypts and signs) data for a remote peer into an envelope.

```typescript
import { wrap } from "@xkore/dices";

const envelope = await wrap(remoteNodeId, data, overlay);
```

Creates an authenticated encrypted envelope using the bounded triple ratchet protocol. Automatically fetches initiation keys from the DHT for first messages. Initializes new ratchet sessions automatically. Handles ML-KEM rotation when message or time bounds are reached.

**Parameters:**

- `remoteNodeId`: 20-byte nodeId of the recipient (Uint8Array)
- `data`: Plaintext data to encrypt (Uint8Array)
- `overlay`: The DICES overlay instance

**Returns:** `Promise<Envelope>`

**Throws:** `DicesOverlayError` if unable to fetch initiation keys or state save fails

**Example:**

```typescript
import { wrap } from "@xkore/dices";

// Both first and subsequent messages use the same simple API
const envelope = await wrap(bobNodeId, messageData, overlay);

// Send envelope via your transport
await overlay.send(bobTarget, envelope.buffer);
```

### unwrap()

Unwraps (decrypts and authenticates) an envelope from a remote peer.

```typescript
import { unwrap } from "@xkore/dices";

const data = await unwrap(envelope, overlay);
```

Performs signature verification, initializes ratchet state if needed (for first message), handles DH ratchet updates, decrypts the message, and persists updated ratchet state.

**Parameters:**

- `envelope`: The encrypted envelope to unwrap (Envelope instance or Uint8Array buffer)
- `overlay`: The DICES overlay instance

**Returns:** `Promise<Uint8Array>` - Decrypted plaintext data

**Throws:** `DicesOverlayError` if signature verification fails, ratchet state invalid, or decryption fails

**Example:**

```typescript
import { unwrap } from "@xkore/dices";

// Listen for incoming messages
overlay.events.on("message", async (message, context) => {
	try {
		// Decrypt and verify - unwrap accepts buffer directly
		const data = await unwrap(context.buffer, overlay);

		console.log("Received message:", new TextDecoder().decode(data));
	} catch (error) {
		console.error("Failed to unwrap envelope:", error);
	}
});
```

### close()

Closes the overlay and cleans up resources.

```typescript
await overlay.close();
```

Stops healthcheck and prune intervals, disconnects the DICE client, and closes the database connection. Should be called when the overlay is no longer needed to prevent resource leaks.

**Returns:** `Promise<void>`

**Example:**

```typescript
// Open overlay
await overlay.open();

// ... use overlay for encrypted communication ...

// Cleanup when done
await overlay.close();
console.log("Overlay closed and resources cleaned up");
```

## Cryptography

DICES is inspired by and builds upon Signal's SPQR (Signal Protocol Post-Quantum Ratchet) system, adapting it for P2P networks with important improvements.

### How It Works

The system uses a **triple ratchet** - three independent mechanisms that continuously update encryption keys:

1. **Symmetric Ratchet**: Derives new message keys from a chain key using a one-way function (HMAC). Even if someone captures a message key, they can't reverse-engineer previous keys. This provides forward secrecy within a session.

2. **DH Ratchet**: Uses X25519 (classical elliptic curve) ephemeral key exchanges. Each side can generate new ephemeral keys, and when both sides have updated, a completely new shared secret is created. This provides backward secrecy - if your keys are compromised, new messages stay protected once you rotate.

3. **KEM Ratchet**: Uses ML-KEM-1024 (quantum-resistant key encapsulation). Like the DH ratchet but protected against quantum computer attacks. ML-KEM is part of NIST's post-quantum cryptography standards (FIPS 203).

All three ratchets work together - the output of the KEM and DH ratchets feeds into the symmetric ratchet, which generates the actual encryption keys for messages.

**Additional Cryptography Components:**
- **XChaCha20-Poly1305**: The actual message encryption - authenticated encryption with extended nonce space
- **HKDF-SHA256**: Derives multiple keys from ratchet outputs with domain separation (ensures keys used for different purposes can't interfere)
- **secp256k1**: Node identity and message signatures (same curve as Bitcoin)
- **X25519**: Classical elliptic curve key exchange for defense-in-depth alongside ML-KEM

### Bounded Rotation

Signal's SPQR system has a potential weakness: unbounded one-sided messaging. If Alice keeps sending messages to Bob without getting replies, the ML-KEM keys never rotate because rotation requires participation from both parties. This means a very powerful attacker could potentially store all messages and wait for quantum computers.

DICES solves this with **bounded rotation** - automatic ML-KEM key rotation enforced by limits:

- **Message bound**: New ML-KEM keys generated after N messages (default: 100)
- **Time bound**: New ML-KEM keys generated after T time passes (default: 1 hour)

When either limit is reached, the sending node generates fresh ML-KEM keys, publishes them to the DHT, and forces rotation. The DH ratchet continues normally. This maintains all the forward/backward secrecy properties while ensuring quantum resistance doesn't degrade over time.

You can configure these bounds when creating an overlay:

```typescript
const overlay = new Overlay({
	// ... other options
	maxMessagesBeforeRotation: 50,        // Rotate after 50 messages
	maxTimeBeforeRotation: 1800000,       // Rotate after 30 minutes
});
```

## Events

The overlay emits events for monitoring and message handling:

```typescript
// Connection events
overlay.events.on("open", () => {
	console.log("Overlay opened");
});

overlay.events.on("close", () => {
	console.log("Overlay closed");
});

// Error events
overlay.events.on("error", (error) => {
	console.error("Overlay error:", error);
});

// Message events
overlay.events.on("message", (message, context) => {
	// Handle incoming message
});

// Node updates (when local node's diceAddress changes)
overlay.events.on("node", (previousNode, nextNode) => {
	console.log("Node updated:", nextNode);
});

// Key rotation
overlay.events.on("rotate", (initiationKeys) => {
	console.log("Rotated initiation keys:", initiationKeys.keyId);
});
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Build the package
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run specific integration test
npm run integration -- testName
```

### Project Structure

```
packages/dices/
├── src/
│   ├── models/
│   │   ├── Overlay/         # Main class, wrap/unwrap functions
│   │   ├── Keys/            # secp256k1 identity
│   │   ├── RatchetKeysItem/ # Initiation keys (ML-KEM + X25519)
│   │   ├── RatchetStateItem/# Per-peer ratchet sessions
│   │   ├── Value/           # DHT record with signatures
│   │   ├── Envelope/        # Wire format
│   │   ├── CipherData/      # XChaCha20-Poly1305 encryption
│   │   └── Nodes/           # Kademlia routing table
│   └── utilities/
│       └── (KDF functions, key derivation)
└── package.json
```

## License

MIT

## Related

- [@xkore/dice](https://www.npmjs.com/package/@xkore/dice) - DHT-based UDP connectivity protocol
- [kademlia-table](https://www.npmjs.com/package/kademlia-table) - Kademlia routing table implementation
- [bufferfy](https://www.npmjs.com/package/bufferfy) - Binary serialization library
