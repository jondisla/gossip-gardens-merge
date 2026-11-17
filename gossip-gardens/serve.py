"""Tiny local web server for Gossip Gardens.

Like `python -m http.server`, but it tells browsers never to keep old copies, so after an update your phone
always shows the newest game without having to clear its cache.
Usage: python serve.py [port]      (default 8080)
"""
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with Server(('0.0.0.0', port), NoCacheHandler) as httpd:
        print('Serving on port', port, '(no caching). Press Ctrl+C to stop.')
        httpd.serve_forever()
