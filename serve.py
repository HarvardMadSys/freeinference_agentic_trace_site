"""Serve a folder over HTTP for looking at the site locally, answering range requests as the deployed host does.

DuckDB reads a Parquet file in pieces, one HTTP range request per piece. Python's standard `http.server` ignores
the Range header and sends the whole file every time, so a page that needs a few hundred kilobytes would download
tens of megabytes. This server answers a `bytes=start-end` range with status 206 and only those bytes; everything
else it serves as `http.server` does. Requests are handled in threads, so the browser's parallel reads do not queue.
"""

import argparse
import functools
import http.server
import os
import re

RANGE_HEADER = re.compile(r"bytes=(\d+)-(\d*)")  # the one form of Range DuckDB sends: a start, and an optional end
CHUNK_BYTES = 1 << 20  # a range is written to the socket in pieces of this size


class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler that answers a single byte range with status 206."""

    def send_head(self):
        """Send the headers; return the open file positioned at the start of the range, or None."""
        self.range_length = None
        match = RANGE_HEADER.fullmatch(self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if match is None or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start = int(match.group(1))
        end = min(int(match.group(2)) if match.group(2) else size - 1, size - 1)
        if start > end:
            self.send_error(http.HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            return None
        handle = open(path, "rb")
        handle.seek(start)
        self.range_length = end - start + 1
        self.send_response(http.HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.range_length))
        self.end_headers()
        return handle

    def copyfile(self, source, outputfile):
        """Write the whole file, or only the range send_head chose."""
        if self.range_length is None:
            super().copyfile(source, outputfile)
            return
        left = self.range_length
        while left > 0:
            chunk = source.read(min(left, CHUNK_BYTES))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def end_headers(self):
        """Every answer says ranges are accepted, so DuckDB asks for them."""
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


def serve(directory: str, port: int) -> None:
    """Serve `directory` on localhost at `port` until interrupted."""
    handler = functools.partial(RangeRequestHandler, directory=directory)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving {directory} at http://localhost:{port}")
        server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--directory", default="site", help="the folder to serve (default: site)")
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    serve(arguments.directory, arguments.port)


if __name__ == "__main__":
    main()
