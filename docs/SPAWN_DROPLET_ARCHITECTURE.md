# OpenClaw Spawn Droplet Architecture

High-level flow: bonded token → Spawn Droplet → choose size (2GB / 4GB) → pay SOL → minimal Ubuntu droplet → SSH + setup guide (no agent URL).

Rendered diagram (matching Hatch Architecture style): [`public/images/spawn-droplet-architecture.png`](../public/images/spawn-droplet-architecture.png).

```mermaid
flowchart TB
  subgraph UserLayer["USER"]
    direction LR
    Profile["Profile (bonded token)"]
    SpawnCTA["Spawn Droplet"]
    SpawnPage["/spawn/[mint]"]
    ChooseSize["Choose 2GB (0.5 SOL) or 4GB (1 SOL)"]
    Treasury["Treasury wallet (SOL + memo)"]
    PollSpawn["Poll spawn-status"]
    Success["Success: Droplet IP, SSH instructions, setup guide"]
    Profile --> SpawnCTA --> SpawnPage --> ChooseSize --> Treasury
    ChooseSize --> PollSpawn
    Treasury --> Treasury
    PollSpawn <-->|"spawn-status query / response"| SpawnStatusAPI
    PollSpawn --> Success
  end

  subgraph BackendLayer["EVE.ARMY BACKEND"]
    LaunchAPI["launch-record API"]
    CreatorAPI["creator-tokens API"]
    LaunchesAPI["launches API"]
    Firestore["Firestore (openclaw_launches, spawn_intents)"]
    SpawnIntentAPI["spawn-intent API"]
    SpawnAPI["Spawn API"]
    SpawnStatusAPI["spawn-status API"]
    SolanaRPC["Solana RPC"]
    DOAPI["DigitalOcean API"]
    LaunchesAPI --> Firestore
    SpawnIntentAPI -->|"verify treasury tx"| SolanaRPC
    SpawnIntentAPI --> Firestore
    SpawnAPI -->|"POST /v2/droplets with size"| DOAPI
    SpawnAPI --> Firestore
    SpawnStatusAPI -->|"GET /v2/droplets/:id"| DOAPI
    DOAPI -->|"dropletId, dropletIp"| SpawnStatusAPI
    SpawnStatusAPI --> Firestore
  end

  subgraph DOLayer["DIGITALOCEAN DROPLETS"]
    Droplet["Droplet (minimal Ubuntu)"]
    UserData["user_data (optional minimal cloud-init)"]
    UserDataNote["no Docker or OpenClaw container"]
    DOAPI -->|"user_data"| Droplet
    Droplet --> UserData
    UserData --> UserDataNote
  end
```

## Summary

| Layer | Components |
|-------|-------------|
| **USER** | Profile → Spawn Droplet → /spawn/[mint] → choose 2GB/4GB → pay SOL (spawn-intent) → poll spawn-status → success shows **Droplet IP**, **SSH instructions**, **OpenClaw setup guide**. No agent URL link. |
| **BACKEND** | spawn-intent API (create intent by size, verify tx); Spawn API (create minimal droplet with size); spawn-status API (return dropletIp); Firestore (spawn_intents, deployDropletId, dropletIp). |
| **DIGITALOCEAN** | Droplet created with chosen size (s-1vcpu-2gb or s-2vcpu-4gb). Minimal Ubuntu; no OpenClaw container, no gateway token. User SSHs in and installs OpenClaw per guide. |
