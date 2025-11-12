# Requirements Document

## Introduction

Cloudflare Workers の Cache API を用い、`getCloudflareContext()` 等で環境を解決しつつ、任意のキーと型付けされた値を TTL 付きでキャッシュできる型安全なヘルパー（`src/lib/cache.ts`）を提供する。これにより外部 API（Dex Screener 等）や重い計算結果・安定レスポンスを短期間キャッシュし、外部依存へのアクセス削減、レイテンシ低減、スループット向上、コスト最適化、および UX 向上を実現する。

## Requirements

### Requirement 1: 型安全なキー値キャッシュ（Key-Value Cache）

**Objective:** As a server developer, I want a type-safe key-value cache utility, so that I can store and retrieve arbitrary typed values with TTL on Cloudflare edge.

#### Acceptance Criteria

1. WHEN a caller invokes getOrSet<T>(key, compute, { ttlSeconds }) THEN the Cache Helper SHALL return a cached value of type T if valid, otherwise compute, store with TTL via Cache-Control, and return the computed value.
2. IF Cache API is unavailable in the current environment THEN the Cache Helper SHALL bypass caching and return the computed value without throwing.
3. WHILE the cached entry is not expired THE Cache Helper SHALL not execute the compute function and SHALL serve the cached entry.
4. WHERE key namespaces/versioning are used THE Cache Helper SHALL treat different keys as independent entries.
5. WHEN multiple concurrent getOrSet<T> are issued for the same key THEN the Cache Helper SHALL deduplicate by reusing a single in-flight computation per key.

### Requirement 2: Request/Response レベルのキャッシュ

**Objective:** As an API developer, I want to cache full HTTP responses by request URL, so that repeated requests within TTL are served from edge without recomputation.

#### Acceptance Criteria

1. WHEN a route handler wraps GET with withRequestCache(request, ttlSeconds, buildResponse) THEN the system SHALL return a cached Response when available within TTL, else build, store with TTL, and return it.
2. IF a Response contains Set-Cookie header THEN the system SHALL avoid caching or strip that header before cache.put to comply with Cache API constraints.
3. WHILE TTL has not elapsed THE system SHALL serve the cached Response for the same request URL without executing buildResponse again.
4. WHERE Cache-Tag is present on the Response THE system SHALL store it to enable future tag-based purge (if adopted later).

### Requirement 3: 環境解決と互換性（getCloudflareContext）

**Objective:** As a platform engineer, I want robust environment resolution, so that caching gracefully degrades outside of Cloudflare while fully leveraging edge cache on Cloudflare.

#### Acceptance Criteria

1. WHEN resolving environment via getCloudflareContext() THEN the Cache Helper SHALL safely access caches.default and Worker context without throwing.
2. IF the code is executed outside Cloudflare Workers (for example, local dev without Miniflare) THEN the Cache Helper SHALL gracefully skip cache operations and still return correct values.
3. WHERE Next.js Route Handlers are used on Cloudflare runtime THE helper SHALL accept the platform Request object for request-level caching.
4. WHILE running in supported Cloudflare environments THE helper SHALL set Cache-Control with max-age=TTL to control edge TTL as per platform spec.

### Requirement 4: 可観測性と失敗時のフォールバック

**Objective:** As a platform operator, I want graceful degradation and observability, so that the system remains diagnosable under cache failures.

#### Acceptance Criteria

1. WHEN cache.match or cache.put throws THEN the system SHALL fall back to returning the computed value and SHALL log the incident with context (key/route/ttl).
2. IF the compute function throws THEN the system SHALL propagate the error and SHALL NOT write an invalid cache entry.
3. WHILE log level permits THE system SHALL emit debug logs on cache hit, miss, and put to aid investigation.
4. WHERE metrics are collected later THE helper design SHALL allow extension without breaking the API surface.

### Requirement 5: 適用対象（外部アクセス削減・UX向上）

**Objective:** As a product engineer, I want to apply caching to high-traffic or heavy endpoints, so that external API calls are reduced and latency is improved.

#### Acceptance Criteria

1. WHEN applying cache to /api/mc THEN the system SHALL cache the JSON response for approximately 60 seconds, reducing upstream Dex Screener calls within that window.
2. WHEN applying cache to /api/tokens/[ticker] THEN the system SHALL allow a short TTL (for example, 30–120 seconds) to improve client latency with acceptable staleness.
3. WHERE internal services compute stable summaries (for example, market-cap aggregation) THE system SHALL allow using the key-value cache helper to memoize results per minute.
4. WHILE cache is effective THE client-observed latency for cached endpoints SHALL decrease compared to the uncached baseline under typical conditions.

### Requirement 6: セキュリティ・HTTP ヘッダ制約

**Objective:** As a security-conscious engineer, I want compliance with platform cache rules, so that responses are safely cacheable.

#### Acceptance Criteria

1. IF a Response includes Set-Cookie THEN the system SHALL not store it in cache unless the header is stripped or appropriately marked to avoid cache rejection.
2. WHERE Cache-Control is absent on the Response THE helper SHALL set Cache-Control: public, max-age={ttlSeconds} before cache.put.
3. WHILE ETag/Last-Modified headers are present THE cache behavior SHALL remain compatible with platform’s conditional requests.

### Requirement 7: 型安全 API と配置

**Objective:** As a developer, I want a clear and type-safe API surface, so that adoption is easy and safe.

#### Acceptance Criteria

1. WHEN creating the helper THE system SHALL provide a type-safe getOrSet<T>(...) API and a withRequestCache(...) wrapper in src/lib/cache.ts.
2. WHERE text and binary content are required THE system SHALL provide getOrSetText and a binary-friendly variant (for example, ArrayBuffer) without breaking the JSON path.
3. WHILE maintaining minimal footprint THE helper SHALL avoid framework-specific dependencies beyond getCloudflareContext and Web Platform APIs.

# Requirements Document

## Project Description (Input)

cahce

## Requirements

<!-- Will be generated in /kiro/spec-requirements phase -->
