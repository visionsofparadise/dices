# DICES Bootstrap Nodes

Bootstrap nodes for DICES network testing. Runs multiple DICES overlay instances that are connected to each other for manual testing.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Generate secret keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the generated keys to `.env` as a comma-separated list.

## Usage

### Run with npm
```bash
npm start
```

### Run with CLI options
```bash
npm start -- -4 127.0.0.1 -p 5173,5174,5175 -s <key1>,<key2>,<key3> -l 1
```

### CLI Options
- `-c, --concurrency <number>`: Concurrency of find operations (default: 3)
- `-4, --ipv4 <string>`: IPv4 address to bind to
- `-6, --ipv6 <string>`: IPv6 address to bind to
- `-l, --log-level <number>`: Log level 0-5, 0 being all logs (default: 1)
- `-p, --ports <string>`: Comma separated list of ports
- `-s, --secret-keys <string>`: Comma separated list of secret keys as hex

### Environment Variables
All CLI options can also be set via environment variables in `.env`:
- `CONCURRENCY`
- `IPV4`
- `IPV6`
- `LOG_LEVEL`
- `PORTS`
- `SECRET_KEYS`

## What it does

1. Creates UDP sockets for each port
2. Initializes DiceClient instances with the sockets
3. Creates Overlay instances for each secret key
4. Sets up relay addresses between all overlays
5. Opens all overlays and logs their node IDs and endpoints

The overlays will stay running and can communicate with each other for testing purposes.
