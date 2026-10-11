"""serve.py answers a byte range with status 206 and exactly those bytes, as the deployed host does and as DuckDB needs."""

import http.client
import http.server
import pathlib
import threading
import functools
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import serve  # noqa: E402  the module sits beside the Makefile, not in a package


@pytest.fixture
def served(tmp_path: pathlib.Path):
    """A server over a folder holding one 1000-byte file, on a free port; yields (port, the file's bytes)."""
    content = bytes(range(256)) * 4
    (tmp_path / "data.parquet").write_bytes(content)
    handler = functools.partial(serve.RangeRequestHandler, directory=str(tmp_path))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_address[1], content
    server.shutdown()


def get(port: int, headers: dict) -> http.client.HTTPResponse:
    connection = http.client.HTTPConnection("127.0.0.1", port)
    connection.request("GET", "/data.parquet", headers=headers)
    return connection.getresponse()


def test_a_range_returns_only_those_bytes(served) -> None:
    port, content = served
    response = get(port, {"Range": "bytes=10-19"})
    assert response.status == 206
    assert response.getheader("Content-Range") == "bytes 10-19/1024"
    assert response.getheader("Accept-Ranges") == "bytes"
    assert response.read() == content[10:20]


def test_an_open_ended_range_runs_to_the_end(served) -> None:
    port, content = served
    response = get(port, {"Range": "bytes=1000-"})
    assert response.status == 206
    assert response.read() == content[1000:]


def test_without_a_range_the_whole_file_is_sent(served) -> None:
    port, content = served
    response = get(port, {})
    assert response.status == 200
    assert response.getheader("Accept-Ranges") == "bytes"
    assert response.read() == content


def test_a_range_past_the_end_is_refused(served) -> None:
    port, _ = served
    assert get(port, {"Range": "bytes=2000-2010"}).status == 416
