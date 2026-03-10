# Scrapbox private project API: research & rationale

This file contains background research and design justification for the
`scrapbox-private-pages` skill. It is derived from a separate report
created during development.

## Read‑only API endpoints

Scrapbox documents several REST endpoints for retrieving data. These
include listing pages via `/api/pages/:projectName` and fetching a
specific page’s metadata or text via
`/api/pages/:projectName/:pageTitle` and
`/api/pages/:projectName/:pageTitle/text`【262805452486776†L8-L29】. These
endpoints are used by the `list_pages` and `get_page` functions in
this skill.

## Creating pages via URL

There is no official REST endpoint for creating or updating pages.
However, Scrapbox’s web interface supports a special URL format:
`/プロジェクト名/ページタイトル?body=本文`. When accessed by a
logged‑in user, this URL creates a new page with the given body or
appends the body to an existing page【816266854850144†L52-L64】. The
`create_page` function automates this mechanism.

## Authentication with `connect.sid`

Private projects require authentication. Scrapbox stores the session
identifier in a cookie named `connect.sid`. The value of this cookie
must be included in the `Cookie` header for API requests. You can
obtain it from your browser’s developer tools by navigating to
`Application` → `Cookies` → `https://scrapbox.io`【334427009481422†L792-L815】. Be
sure to decode the first `%3A` to a colon before use.

## MCP server alternative

The open‑source `scrapbox-cosense-mcp` server exposes a richer set of
capabilities (including page creation via WebSockets) and may offer a
more robust integration path【334427009481422†L684-L690】. This skill
chooses the simpler URL‑based approach for ease of deployment in
environments without WebSocket support.
