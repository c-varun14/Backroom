#!/usr/bin/env python3
"""Root-side Switch identity lookup for the studio server.

The desk runs without Docker access on purpose: Docker group membership is
root-equivalent. This service owns the one query the desk needs, so callers on
the socket send only validated ids and can never supply SQL.
"""
import json
import os
import re
import socket
import socketserver
import subprocess
import sys

PATH = os.environ.get('BACKROOM_IDENTITY_SOCKET', '/run/backroom-identity.sock')
GROUP = os.environ.get('BACKROOM_IDENTITY_GROUP', 'backroom')
ID = re.compile(r'^[a-f0-9-]{36}$')


def query(request):
    agents = list(dict.fromkeys([request['deskId'], request['leadId'], request['probeId'], *request.get('agentIds', [])]))
    for value in [request['ownerId'], request['bridgeId'], *agents]:
        if not isinstance(value, str) or not ID.fullmatch(value):
            raise ValueError('Invalid identity configuration')
    listed = ','.join(f"'{agent}'" for agent in agents)
    return f"""SELECT COALESCE(json_agg(x),'[]'::json) FROM (
    SELECT c.matrix_user_id AS sender,
      CASE WHEN a.id IS NOT NULL THEN 'agent' ELSE 'human' END AS kind,
      a.id AS agent_id,
      COALESCE(array_agg(DISTINCT COALESCE(to_jsonb(e)->>'external_user_id',to_jsonb(e)->>'external_id')) FILTER (WHERE e.id IS NOT NULL),'{{}}'::text[]) AS external_ids,
      COALESCE(array_agg(DISTINCT claim.user_id) FILTER (WHERE claim.user_id IS NOT NULL),'{{}}'::text[])
      || CASE WHEN c.user_id IS NOT NULL THEN ARRAY[c.user_id] ELSE '{{}}'::text[] END AS users
    FROM clients c LEFT JOIN agents a ON a.client_id=c.id
    LEFT JOIN external_users e ON e.client_id=c.id
    LEFT JOIN external_user_claims claim ON claim.external_user_id=e.id
    WHERE e.bridge_id='{request['bridgeId']}' OR a.id IN ({listed}) OR c.user_id='{request['ownerId']}'
    GROUP BY c.matrix_user_id,a.id,c.user_id) x;"""


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            request = json.loads(self.rfile.readline(65536))
            result = subprocess.run(
                ['docker', 'exec', 'backroom-block0-postgres-1', 'psql', '-U', 'backroom_owner', '-d', 'backroom_switch', '-At', '-c', query(request)],
                capture_output=True, timeout=10, check=True)
            json.loads(result.stdout)
            self.wfile.write(result.stdout)
        except Exception as error:
            print('identity lookup failed:', type(error).__name__, file=sys.stderr, flush=True)


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True


def main():
    if os.path.exists(PATH):
        os.unlink(PATH)
    with Server(PATH, Handler) as server:
        import grp
        os.chown(PATH, 0, grp.getgrnam(GROUP).gr_gid)
        os.chmod(PATH, 0o660)
        print('identity helper listening', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
