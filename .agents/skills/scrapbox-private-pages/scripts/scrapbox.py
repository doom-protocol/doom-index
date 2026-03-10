"""
scrapbox.py
===========

This module provides helper functions for working with Cosense/Scrapbox
private projects.  It is intended to be used as part of the
`scrapbox-private-pages` skill.  See the `SKILL.md` file in the
parent directory for usage instructions.

The functions defined here wrap the internal REST-style APIs exposed
by Scrapbox and hide the details of authentication and URL encoding.

**Important notes**

1. These functions require a valid `connect.sid` cookie when the target
   project is private.  You can retrieve the value of this cookie
   manually from your browser via the developer tools (Application
   -> Cookies -> `https://scrapbox.io` -> `connect.sid`).  Do not commit
   the cookie to version control.
2. Cosense officially documents read-only REST endpoints for listing
   pages and fetching their content.  Page creation is not provided as
   a traditional REST API.  The ``create_page`` function below uses
   the ``/api/page-data/import/{project}.json`` endpoint, which accepts
   a multipart file upload containing a JSON payload with pages and
   their lines.  This requires a valid ``connect.sid`` cookie **and**
   a CSRF token, which is obtained automatically from ``/api/users/me``.

The functions defined here are deliberately simple so that they can
serve as building blocks for higher-level workflows.  They return
Python dictionaries rather than bespoke classes, making them easy to
serialize to JSON if necessary.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


def _build_base_headers(sid_cookie: Optional[str] = None) -> Dict[str, str]:
    """Return a headers dictionary with the cookie when provided."""
    headers: Dict[str, str] = {
        "User-Agent": "scrapbox-private-pages/1.0 (+https://scrapbox.io)"
    }
    if sid_cookie:
        headers["Cookie"] = f"connect.sid={sid_cookie}"
    return headers


def _get_csrf_token(sid_cookie: str) -> str:
    """Fetch the CSRF token from /api/users/me.

    The Scrapbox import API requires a CSRF token sent via the
    ``X-CSRF-TOKEN`` header.  This token is available in the
    ``csrfToken`` field of the ``/api/users/me`` response.

    Args:
        sid_cookie: A valid ``connect.sid`` cookie.

    Returns:
        The CSRF token string.

    Raises:
        RuntimeError: If the token cannot be retrieved.
    """
    headers = _build_base_headers(sid_cookie)
    resp = requests.get("https://scrapbox.io/api/users/me", headers=headers)
    resp.raise_for_status()
    data = resp.json()
    token = data.get("csrfToken")
    if not token:
        raise RuntimeError(
            "Could not retrieve CSRF token from /api/users/me. "
            "Is the connect.sid cookie valid?"
        )
    return token


def list_pages(
    project_name: str,
    sid_cookie: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """Fetch a list of pages from a Scrapbox project.

    Args:
        project_name: The name of the Scrapbox project to query.
        sid_cookie: Optional `connect.sid` cookie for authentication.
        skip: How many pages to skip (default 0).
        limit: How many pages to fetch (default 100).

    Returns:
        The parsed JSON response from Scrapbox.  On success the
        top-level keys include ``count`` and ``pages`` where
        ``pages`` is a list of page metadata dictionaries.
    """
    base_url = f"https://scrapbox.io/api/pages/{project_name}"
    params = {"skip": skip, "limit": limit}
    headers = _build_base_headers(sid_cookie)
    logger.debug("Fetching page list: %s with params %s", base_url, params)
    response = requests.get(base_url, params=params, headers=headers)
    response.raise_for_status()
    return response.json()


def get_page(
    project_name: str,
    page_title: str,
    sid_cookie: Optional[str] = None,
    include_text: bool = True,
) -> Dict[str, Any]:
    """Retrieve metadata and optionally the full text of a Scrapbox page.

    Args:
        project_name: Name of the project.
        page_title: Title of the page to retrieve.
        sid_cookie: Optional `connect.sid` cookie for authentication.
        include_text: Whether to fetch the page body as plain text.

    Returns:
        A dictionary with the keys ``meta`` containing metadata and
        optionally ``text`` containing the page body.
    """
    import urllib.parse as _urlparse

    encoded_title = _urlparse.quote(page_title)
    base_meta_url = f"https://scrapbox.io/api/pages/{project_name}/{encoded_title}"
    headers = _build_base_headers(sid_cookie)
    logger.debug("Fetching page metadata: %s", base_meta_url)
    meta_resp = requests.get(base_meta_url, headers=headers)
    meta_resp.raise_for_status()
    meta = meta_resp.json()
    result: Dict[str, Any] = {"meta": meta}
    if include_text:
        text_url = f"{base_meta_url}/text"
        logger.debug("Fetching page text: %s", text_url)
        text_resp = requests.get(text_url, headers=headers)
        text_resp.raise_for_status()
        result["text"] = text_resp.text
    return result


def create_page(
    project_name: str,
    title: str,
    body: str = "",
    sid_cookie: str | None = None,
) -> Dict[str, Any]:
    """Create a new page in a Scrapbox project via the import API.

    Uses the ``/api/page-data/import/{project}.json`` endpoint with
    multipart file upload.  This is the reliable server-side method
    for creating pages with content.  The old ``?body=`` GET approach
    only works in a browser context and does not write the body when
    called from a plain HTTP client.

    The body text can include newlines (``\\n``) and should be plain
    Scrapbox markup.  If the page already exists, the content will be
    merged/appended by Scrapbox.

    Args:
        project_name: Target project name.
        title: Title of the new page.
        body: Optional body text (Scrapbox markup).  Defaults to empty.
        sid_cookie: `connect.sid` cookie for authentication; required
            when creating pages in private projects.

    Returns:
        A dictionary containing the ``message`` from Scrapbox and
        the HTTP ``status`` code.
    """
    if not sid_cookie:
        raise ValueError(
            "A valid connect.sid cookie is required to create pages. "
            "Obtain the cookie from your browser's developer tools."
        )

    csrf_token = _get_csrf_token(sid_cookie)

    # Build the lines array: first line is always the title
    lines = [title]
    if body:
        lines.extend(body.split("\n"))

    import_data = {
        "pages": [
            {
                "title": title,
                "lines": lines,
            }
        ]
    }

    headers = _build_base_headers(sid_cookie)
    headers["X-CSRF-TOKEN"] = csrf_token

    json_str = json.dumps(import_data, ensure_ascii=False)
    files = {
        "import-file": ("import.json", json_str, "application/json"),
    }

    url = f"https://scrapbox.io/api/page-data/import/{project_name}.json"
    logger.debug("Creating page via import API: %s", url)
    resp = requests.post(url, headers=headers, files=files)
    resp.raise_for_status()

    return {"message": resp.json().get("message", ""), "status": resp.status_code}


def main() -> None:
    """Small command line utility for manual testing.

    Reads `SCRAPBOX_PROJECT`, `SCRAPBOX_TITLE`, `SCRAPBOX_BODY`, and
    `SCRAPBOX_SID` environment variables.  If ``SCRAPBOX_TITLE`` is
    provided it will create a new page; otherwise it will list the
    first 10 pages of the project.
    """
    project = os.environ.get("SCRAPBOX_PROJECT")
    title = os.environ.get("SCRAPBOX_TITLE")
    body = os.environ.get("SCRAPBOX_BODY", "")
    sid = os.environ.get("SCRAPBOX_SID")
    if not project:
        raise SystemExit("Please set SCRAPBOX_PROJECT to the target project name.")
    if title:
        result = create_page(project, title, body, sid_cookie=sid)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        pages = list_pages(project, sid_cookie=sid, limit=10)
        print(json.dumps(pages, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
