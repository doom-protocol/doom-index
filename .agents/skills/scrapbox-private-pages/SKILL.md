---
name: scrapbox-private-pages
description: >-
  Read from and write to private Cosense/Scrapbox projects.  Use this
  skill when a user asks to list, retrieve, or create pages in a Cosense
  project, particularly when the project is private and requires
  authentication via a `connect.sid` cookie.
license: MIT
metadata:
  author: asuma
  version: "2.0"
allowed-tools: python
---

# Scrapbox private project page management

## When to use this skill

Use this skill when the user needs to interact with a Cosense/Scrapbox project
by reading existing pages or creating new ones. This includes:

- Listing pages in a project.
- Retrieving a page's metadata and body content.
- Creating a new page or appending content to an existing page.

It is particularly useful for private projects that require a session
cookie for authentication.

## How it works

The skill wraps the REST endpoints exposed by Scrapbox. It provides a
Python module in `scripts/scrapbox.py` with helper functions:

- `list_pages(project_name, sid_cookie=None, skip=0, limit=100)`
  - Calls `https://scrapbox.io/api/pages/{project_name}` to fetch page
    metadata.
  - Accepts optional pagination parameters `skip` and `limit`.
  - The `sid_cookie` parameter must be a valid `connect.sid` cookie
    string for private projects.

- `get_page(project_name, page_title, sid_cookie=None, include_text=True)`
  - Retrieves metadata via `/api/pages/{project}/{title}` and, if
    `include_text` is `True`, fetches the body text via
    `/api/pages/{project}/{title}/text`.
  - Returns a dictionary containing both metadata and body text.

- `create_page(project_name, title, body="", sid_cookie)`
  - Creates a new page using the **import API**
    (`/api/page-data/import/{project}.json`) with multipart file upload.
  - Automatically fetches a CSRF token from `/api/users/me`.
  - Requires the `sid_cookie` parameter (always required for writes).
  - If the page already exists, content will be merged/appended.
  - **Note**: The old `?body=` GET approach does NOT work from a plain
    HTTP client (it only works in a browser context where JavaScript
    processes the body parameter). The import API is the reliable
    server-side method.

The module uses the `requests` library and expects Python 3.8+.

## Preparing your environment

1. Install the Python dependencies (if not already available):

   ```bash
   pip install requests
   ```

2. Obtain your `connect.sid` cookie value if working with a private
   project. In your browser, open the Scrapbox project while logged in.
   Then open Developer Tools -> Application -> Cookies -> `https://scrapbox.io`
   and find the value of the `connect.sid` cookie. Store this secret
   securely and never commit it to source control.

## Running the script

The script in `scripts/scrapbox.py` can be used directly from the
command line to perform simple operations. It reads the following
environment variables:

- `SCRAPBOX_PROJECT`: The project name (required).
- `SCRAPBOX_TITLE`: If set, the script will create a new page using this
  value as the title. Otherwise it will list pages.
- `SCRAPBOX_BODY`: Body content for the new page (optional).
- `SCRAPBOX_SID`: Your `connect.sid` cookie (optional for public
  projects; required for private projects and all write operations).

Example: list the first ten pages of a public project:

```bash
SCRAPBOX_PROJECT=my-public-project python scripts/scrapbox.py
```

Example: create a page in a private project:

```bash
export SCRAPBOX_PROJECT=my-private-project
export SCRAPBOX_TITLE="Meeting notes 2026-02-14"
export SCRAPBOX_BODY=$'[*** Meeting Info]\nDate: 2026-2-14\nAttendees:\n\n[*** Agenda]\n1. '
export SCRAPBOX_SID=s:your_connect_sid_value
python scripts/scrapbox.py
```

## Additional reference

For more background on the Scrapbox REST APIs and the rationale behind
these helpers, see the `references/REFERENCE.md` file in this skill.
