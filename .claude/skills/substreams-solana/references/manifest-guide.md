# Substreams Manifest Reference (substreams.yaml)

## Complete Example

```yaml
specVersion: v0.1.0

package:
  name: pump-fun-substreams
  version: v0.1.0
  url: https://github.com/your-org/pump-fun-substreams
  doc: |
    Extract trades, token creations, and holder counts from pump.fun.
    Designed for SQL sink to PostgreSQL.

protobuf:
  files:
    - events.proto
    - database.proto
  importPaths:
    - ./proto

binaries:
  default:
    type: wasm/rust-v1
    file: ./target/wasm32-unknown-unknown/release/pump_fun_substreams.wasm

network: solana-mainnet-beta

# Optional: params defaults
params:
  map_trades: "program_id=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"

modules:
  # ============================================
  # Map Modules (Stateless)
  # ============================================

  - name: map_trades
    kind: map
    initialBlock: 280000000
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:pump.v1.Trades
    doc: |
      Extracts buy/sell trades from pump.fun program.
      Filters for successful transactions only.

  - name: map_token_creates
    kind: map
    initialBlock: 280000000
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:pump.v1.TokenCreates

  # ============================================
  # Store Modules (Stateful)
  # ============================================

  - name: store_holder_counts
    kind: store
    initialBlock: 280000000
    updatePolicy: add
    valueType: int64
    inputs:
      - source: sf.solana.type.v2.Block
    doc: |
      Tracks holder count per mint.
      Key format: "hc:{mint_address}"
      Value: delta (+1 or -1)

  - name: store_token_metadata
    kind: store
    initialBlock: 280000000
    updatePolicy: set
    valueType: proto:pump.v1.TokenMetadata
    inputs:
      - map: map_token_creates

  # ============================================
  # Enrichment Modules
  # ============================================

  - name: map_trades_enriched
    kind: map
    initialBlock: 280000000
    inputs:
      - map: map_trades
      - store: store_token_metadata
        mode: get
      - store: store_holder_counts
        mode: deltas
    output:
      type: proto:pump.v1.TradesEnriched

  # ============================================
  # Database Output
  # ============================================

  - name: db_out
    kind: map
    initialBlock: 280000000
    inputs:
      - map: map_trades_enriched
    output:
      type: proto:sf.substreams.sink.database.v1.DatabaseChanges

# ============================================
# Sink Configuration (for substreams-sink-sql)
# ============================================
sink:
  module: db_out
  type: sf.substreams.sink.sql.v1.Service
  config:
    schema: "./schema.sql"
    engine: postgres
    postgraphile_frontend:
      enabled: false
```

## Key Sections

### package

```yaml
package:
  name: pump-fun-substreams # Package name (used in .spkg filename)
  version: v0.1.0 # Semantic version
  url: https://github.com/... # Optional: repository URL
  doc: | # Optional: package documentation
    Multi-line description...
```

### protobuf

```yaml
protobuf:
  files:
    - events.proto # Your proto files
    - database.proto
  importPaths:
    - ./proto # Search paths for imports

  # Alternative: use Buf Schema Registry
  descriptorSets:
    - module: buf.build/streamingfast/substreams-sink-database
```

### binaries

```yaml
binaries:
  default:
    type: wasm/rust-v1 # WASM type
    file: ./target/wasm32-unknown-unknown/release/my_substreams.wasm
```

### network

```yaml
network: solana-mainnet-beta # Target network


# Valid values:
# - solana-mainnet-beta
# - ethereum-mainnet
# - polygon-mainnet
# - etc.
```

### modules

#### Map Module

```yaml
- name: map_trades
  kind: map # Stateless transformation
  initialBlock: 280000000 # First block to process
  inputs:
    - source: sf.solana.type.v2.Block # Raw block input
  output:
    type: proto:pump.v1.Trades # Output protobuf type
  doc: Optional documentation
```

#### Store Module

```yaml
- name: store_holders
  kind: store # Stateful storage
  initialBlock: 280000000
  updatePolicy: add # add | set | set_if_not_exists | append | set_sum
  valueType: int64 # int64 | float64 | bigint | bigdecimal | string | proto:...
  inputs:
    - map: map_trades # Input from another module
```

**Update Policies:**
| Policy | Description |
|--------|-------------|
| `set` | Overwrites value |
| `set_if_not_exists` | Sets only if key doesn't exist |
| `add` | Adds to numeric value |
| `set_sum` | Sum or set (hybrid) |
| `append` | Append to string |

**Value Types:**
| Type | Rust Store Type |
|------|-----------------|
| `int64` | `StoreSetInt64`, `StoreAddInt64` |
| `float64` | `StoreSetFloat64`, `StoreAddFloat64` |
| `bigint` | `StoreSetBigInt`, `StoreAddBigInt` |
| `bigdecimal` | `StoreSetBigDecimal`, `StoreAddBigDecimal` |
| `string` | `StoreSetString`, `StoreAppend` |
| `proto:my.Type` | `StoreSetProto<MyType>` |

#### Module with Store Input

```yaml
- name: map_enriched
  kind: map
  inputs:
    - map: map_trades
    - store: store_metadata
      mode: get # get | deltas
    - store: store_counts
      mode: deltas # Receive changes only
```

**Store Input Modes:**
| Mode | Description | Use Case |
|------|-------------|----------|
| `get` | Read current values | Lookup metadata |
| `deltas` | Receive changes | React to state changes |

### params

Override module parameters at runtime.

```yaml
params:
  map_trades: "program_id=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
  store_holders: "min_balance=1000000"
```

In Rust:

```rust
#[substreams::handlers::map]
fn map_trades(params: String, blk: Block) -> Result<Trades, Error> {
    // params = "program_id=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    let program_id = parse_param(&params, "program_id");
}
```

Override at runtime:

```bash
substreams run ... -p map_trades="program_id=DIFFERENT_PROGRAM"
```

### imports

Reuse modules from other packages:

```yaml
imports:
  solana_common: https://github.com/streamingfast/substreams-solana-common/releases/download/v0.1.0/substreams-solana-common-v0.1.0.spkg

modules:
  - name: map_trades
    inputs:
      - map: solana_common:filtered_transactions
```

### blockFilter (Index Modules)

Speed up processing by filtering blocks:

```yaml
modules:
  - name: index_pump
    kind: blockIndex
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:sf.substreams.index.v1.Keys

  - name: map_trades
    kind: map
    blockFilter:
      module: index_pump
      query:
        string: "program:6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    inputs:
      - source: sf.solana.type.v2.Block
```

## Module DAG Rules

1. **No cycles** - Modules form a Directed Acyclic Graph
2. **stores run before consumers** - Declare stores before maps that read them
3. **Single output type** - Each module has exactly one output
4. **Matching initialBlock** - Dependent modules must have same or later initialBlock

## Common Patterns

### Extract → Store → Enrich → Sink

```yaml
modules:
  # 1. Extract raw events
  - name: map_events
    kind: map
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:my.Events

  # 2. Build state
  - name: store_state
    kind: store
    updatePolicy: set
    valueType: proto:my.State
    inputs:
      - map: map_events

  # 3. Enrich with state
  - name: map_enriched
    kind: map
    inputs:
      - map: map_events
      - store: store_state
        mode: get
    output:
      type: proto:my.EnrichedEvents

  # 4. Output to database
  - name: db_out
    kind: map
    inputs:
      - map: map_enriched
    output:
      type: proto:sf.substreams.sink.database.v1.DatabaseChanges
```

### Multiple Independent Extractions

```yaml
modules:
  - name: map_trades
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:pump.Trades

  - name: map_creates
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:pump.Creates

  - name: db_out
    inputs:
      - map: map_trades
      - map: map_creates
    output:
      type: proto:sf.substreams.sink.database.v1.DatabaseChanges
```
