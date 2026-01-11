# Anchor IDL Type-Safe Integration

## Overview

Anchor IDLs (Interface Definition Language) describe Solana program interfaces in JSON format. This guide covers integrating IDLs into Substreams for type-safe instruction/event decoding.

## Project Structure for IDLs

```
src/
├── lib.rs
├── idl/
│   ├── mod.rs           # Exports all IDL types
│   ├── pump_fun.rs      # pump.fun types
│   └── raydium.rs       # Raydium types (if needed)
└── modules/
    └── map.rs           # Uses idl types

idls/
└── pump_fun.json        # Raw Anchor IDL files
```

## IDL JSON Structure

```json
{
  "version": "0.1.0",
  "name": "pump",
  "instructions": [
    {
      "name": "create",
      "accounts": [
        {"name": "mint", "isMut": true, "isSigner": true},
        {"name": "bondingCurve", "isMut": true, "isSigner": false}
      ],
      "args": [
        {"name": "name", "type": "string"},
        {"name": "symbol", "type": "string"},
        {"name": "uri", "type": "string"}
      ]
    },
    {
      "name": "buy",
      "accounts": [...],
      "args": [
        {"name": "amount", "type": "u64"},
        {"name": "maxSolCost", "type": "u64"}
      ]
    }
  ],
  "events": [
    {
      "name": "TradeEvent",
      "fields": [
        {"name": "mint", "type": "publicKey"},
        {"name": "solAmount", "type": "u64"},
        {"name": "tokenAmount", "type": "u64"},
        {"name": "isBuy", "type": "bool"},
        {"name": "user", "type": "publicKey"},
        {"name": "timestamp", "type": "i64"}
      ]
    }
  ],
  "accounts": [
    {
      "name": "BondingCurve",
      "type": {
        "kind": "struct",
        "fields": [
          {"name": "virtualTokenReserves", "type": "u64"},
          {"name": "virtualSolReserves", "type": "u64"},
          {"name": "realTokenReserves", "type": "u64"},
          {"name": "realSolReserves", "type": "u64"},
          {"name": "tokenTotalSupply", "type": "u64"},
          {"name": "complete", "type": "bool"}
        ]
      }
    }
  ]
}
```

## Rust Type Generation from IDL

### src/idl/mod.rs

```rust
pub mod pump_fun;

pub use pump_fun::*;
```

### src/idl/pump_fun.rs

```rust
use borsh::{BorshDeserialize, BorshSerialize};
use sha2::{Sha256, Digest};

/// Program ID
pub const PUMP_FUN_PROGRAM_ID: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// ============================================
// Discriminators
// ============================================

pub fn instruction_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{}", name));
    let result = hasher.finalize();
    result[..8].try_into().unwrap()
}

pub fn event_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("event:{}", name));
    let result = hasher.finalize();
    result[..8].try_into().unwrap()
}

// Pre-computed discriminators
lazy_static::lazy_static! {
    pub static ref CREATE_IX_DISC: [u8; 8] = instruction_discriminator("create");
    pub static ref BUY_IX_DISC: [u8; 8] = instruction_discriminator("buy");
    pub static ref SELL_IX_DISC: [u8; 8] = instruction_discriminator("sell");

    pub static ref TRADE_EVENT_DISC: [u8; 8] = event_discriminator("TradeEvent");
    pub static ref CREATE_EVENT_DISC: [u8; 8] = event_discriminator("CreateEvent");
}

// ============================================
// Instruction Args (from IDL "args")
// ============================================

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct CreateArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct BuyArgs {
    pub amount: u64,
    pub max_sol_cost: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct SellArgs {
    pub amount: u64,
    pub min_sol_output: u64,
}

// ============================================
// Events (from IDL "events")
// ============================================

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct TradeEvent {
    pub mint: [u8; 32],        // Pubkey as bytes
    pub sol_amount: u64,
    pub token_amount: u64,
    pub is_buy: bool,
    pub user: [u8; 32],
    pub timestamp: i64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct CreateEvent {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub mint: [u8; 32],
    pub bonding_curve: [u8; 32],
    pub user: [u8; 32],
}

// ============================================
// Account Structs (from IDL "accounts")
// ============================================

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct BondingCurve {
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub token_total_supply: u64,
    pub complete: bool,
}

// ============================================
// Account Index Constants (from IDL "accounts" array order)
// ============================================

pub mod buy_accounts {
    pub const GLOBAL: usize = 0;
    pub const FEE_RECIPIENT: usize = 1;
    pub const MINT: usize = 2;
    pub const BONDING_CURVE: usize = 3;
    pub const ASSOCIATED_BONDING_CURVE: usize = 4;
    pub const ASSOCIATED_USER: usize = 5;
    pub const USER: usize = 6;
    pub const SYSTEM_PROGRAM: usize = 7;
    pub const TOKEN_PROGRAM: usize = 8;
    pub const RENT: usize = 9;
    pub const EVENT_AUTHORITY: usize = 10;
    pub const PROGRAM: usize = 11;
}

pub mod sell_accounts {
    pub const GLOBAL: usize = 0;
    pub const FEE_RECIPIENT: usize = 1;
    pub const MINT: usize = 2;
    pub const BONDING_CURVE: usize = 3;
    pub const ASSOCIATED_BONDING_CURVE: usize = 4;
    pub const ASSOCIATED_USER: usize = 5;
    pub const USER: usize = 6;
    pub const SYSTEM_PROGRAM: usize = 7;
    pub const ASSOCIATED_TOKEN_PROGRAM: usize = 8;
    pub const TOKEN_PROGRAM: usize = 9;
    pub const EVENT_AUTHORITY: usize = 10;
    pub const PROGRAM: usize = 11;
}

// ============================================
// Parsing Functions
// ============================================

#[derive(Debug)]
pub enum ParseError {
    InvalidDiscriminator,
    DeserializationFailed(String),
    InsufficientData,
}

pub fn parse_instruction(data: &[u8]) -> Result<InstructionData, ParseError> {
    if data.len() < 8 {
        return Err(ParseError::InsufficientData);
    }

    let disc = &data[0..8];
    let payload = &data[8..];

    if disc == CREATE_IX_DISC.as_ref() {
        let args = CreateArgs::try_from_slice(payload)
            .map_err(|e| ParseError::DeserializationFailed(e.to_string()))?;
        Ok(InstructionData::Create(args))
    } else if disc == BUY_IX_DISC.as_ref() {
        let args = BuyArgs::try_from_slice(payload)
            .map_err(|e| ParseError::DeserializationFailed(e.to_string()))?;
        Ok(InstructionData::Buy(args))
    } else if disc == SELL_IX_DISC.as_ref() {
        let args = SellArgs::try_from_slice(payload)
            .map_err(|e| ParseError::DeserializationFailed(e.to_string()))?;
        Ok(InstructionData::Sell(args))
    } else {
        Err(ParseError::InvalidDiscriminator)
    }
}

pub fn parse_event(data: &[u8]) -> Result<EventData, ParseError> {
    if data.len() < 8 {
        return Err(ParseError::InsufficientData);
    }

    let disc = &data[0..8];
    let payload = &data[8..];

    if disc == TRADE_EVENT_DISC.as_ref() {
        let event = TradeEvent::try_from_slice(payload)
            .map_err(|e| ParseError::DeserializationFailed(e.to_string()))?;
        Ok(EventData::Trade(event))
    } else if disc == CREATE_EVENT_DISC.as_ref() {
        let event = CreateEvent::try_from_slice(payload)
            .map_err(|e| ParseError::DeserializationFailed(e.to_string()))?;
        Ok(EventData::Create(event))
    } else {
        Err(ParseError::InvalidDiscriminator)
    }
}

#[derive(Debug)]
pub enum InstructionData {
    Create(CreateArgs),
    Buy(BuyArgs),
    Sell(SellArgs),
}

#[derive(Debug)]
pub enum EventData {
    Trade(TradeEvent),
    Create(CreateEvent),
}

// ============================================
// Helper Functions
// ============================================

pub fn pubkey_to_string(bytes: &[u8; 32]) -> String {
    bs58::encode(bytes).into_string()
}

pub fn string_to_pubkey(s: &str) -> Option<[u8; 32]> {
    bs58::decode(s).into_vec().ok()?.try_into().ok()
}
```

## Usage in Map Module

### src/modules/map.rs

```rust
use crate::idl::pump_fun::{
    self,
    parse_instruction,
    parse_event,
    InstructionData,
    EventData,
    buy_accounts,
    sell_accounts,
    PUMP_FUN_PROGRAM_ID,
};
use crate::pb::pump::v1::{Trade, Trades};
use substreams::log;
use substreams_solana::pb::sf::solana::r#type::v1::Block;

#[substreams::handlers::map]
pub fn map_trades(blk: Block) -> Result<Trades, substreams::errors::Error> {
    let mut trades = Trades::default();

    for tx in blk.transactions() {
        // Skip failed transactions
        if tx.meta.as_ref().map(|m| m.err.is_some()).unwrap_or(true) {
            continue;
        }

        let account_keys = &tx.transaction.as_ref()
            .unwrap()
            .message.as_ref()
            .unwrap()
            .account_keys;

        for (ix_idx, ix) in tx.instructions().enumerate() {
            // Check if pump.fun instruction
            let program_id = &account_keys[ix.program_id_index as usize];
            if bs58::encode(program_id).into_string() != PUMP_FUN_PROGRAM_ID {
                continue;
            }

            // Parse instruction
            match parse_instruction(&ix.data) {
                Ok(InstructionData::Buy(args)) => {
                    let mint = get_account(ix, account_keys, buy_accounts::MINT);
                    let user = get_account(ix, account_keys, buy_accounts::USER);

                    log::debug!("Buy: {} tokens for max {} SOL",
                        args.amount, args.max_sol_cost);

                    trades.trades.push(Trade {
                        id: format!("{}:{}",
                            bs58::encode(&tx.signature).into_string(),
                            ix_idx
                        ),
                        mint,
                        user,
                        is_buy: true,
                        token_amount: args.amount,
                        max_sol: args.max_sol_cost,
                        slot: blk.slot,
                        timestamp: blk.block_time.as_ref().map(|t| t.timestamp).unwrap_or(0),
                    });
                }
                Ok(InstructionData::Sell(args)) => {
                    let mint = get_account(ix, account_keys, sell_accounts::MINT);
                    let user = get_account(ix, account_keys, sell_accounts::USER);

                    trades.trades.push(Trade {
                        id: format!("{}:{}",
                            bs58::encode(&tx.signature).into_string(),
                            ix_idx
                        ),
                        mint,
                        user,
                        is_buy: false,
                        token_amount: args.amount,
                        min_sol: args.min_sol_output,
                        slot: blk.slot,
                        timestamp: blk.block_time.as_ref().map(|t| t.timestamp).unwrap_or(0),
                    });
                }
                Ok(InstructionData::Create(_)) => {
                    // Handle token creation
                }
                Err(e) => {
                    log::debug!("Failed to parse instruction: {:?}", e);
                }
            }
        }

        // Parse events from logs
        if let Some(meta) = &tx.meta {
            for log in &meta.log_messages {
                if log.starts_with("Program data: ") {
                    let b64 = &log["Program data: ".len()..];
                    if let Ok(data) = base64::decode(b64) {
                        match parse_event(&data) {
                            Ok(EventData::Trade(event)) => {
                                log::debug!("TradeEvent: {} {} tokens",
                                    if event.is_buy { "buy" } else { "sell" },
                                    event.token_amount
                                );
                            }
                            Ok(EventData::Create(event)) => {
                                log::debug!("CreateEvent: {} ({})",
                                    event.name, event.symbol);
                            }
                            Err(_) => {}
                        }
                    }
                }
            }
        }
    }

    Ok(trades)
}

fn get_account(
    ix: &CompiledInstruction,
    keys: &[Vec<u8>],
    index: usize
) -> String {
    ix.accounts
        .get(index)
        .and_then(|&idx| keys.get(idx as usize))
        .map(|k| bs58::encode(k).into_string())
        .unwrap_or_default()
}
```

## Cargo.toml Dependencies

```toml
[dependencies]
substreams = "0.5"
substreams-solana = "0.14"
borsh = "0.10"
sha2 = "0.10"
bs58 = "0.5"
base64 = "0.21"
lazy_static = "1.4"
```

## IDL Type Mapping

| IDL Type            | Rust Type   |
| ------------------- | ----------- |
| `u8`                | `u8`        |
| `u16`               | `u16`       |
| `u32`               | `u32`       |
| `u64`               | `u64`       |
| `u128`              | `u128`      |
| `i8`                | `i8`        |
| `i16`               | `i16`       |
| `i32`               | `i32`       |
| `i64`               | `i64`       |
| `i128`              | `i128`      |
| `bool`              | `bool`      |
| `string`            | `String`    |
| `publicKey`         | `[u8; 32]`  |
| `bytes`             | `Vec<u8>`   |
| `{ option: T }`     | `Option<T>` |
| `{ vec: T }`        | `Vec<T>`    |
| `{ array: [T, N] }` | `[T; N]`    |

## Generating Types from IDL (Script)

For automation, create a build script or use a tool like `solores`:

```bash
# Using solores (generates full Rust interface)
cargo install solores
solores idls/pump_fun.json

# Or manual: read IDL and generate src/idl/pump_fun.rs
```

## Best Practices

1. **Keep IDL JSON files in `idls/`** - Source of truth
2. **Generate Rust types in `src/idl/`** - Type-safe usage
3. **Pre-compute discriminators** - Avoid runtime hashing
4. **Use enums for instruction/event variants** - Exhaustive matching
5. **Define account indices as constants** - Self-documenting code
6. **Add parsing error types** - Better debugging
