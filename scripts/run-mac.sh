#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  python3 - <<'PYGEN'
import secrets
from pathlib import Path
p=Path('.env')
p.write_text('Jwt__Key='+secrets.token_urlsafe(48)+'\nBootstrap__ManagerEmail=manager@logitrack.local\nBootstrap__ManagerPassword='+secrets.token_urlsafe(24)+'!aA1\n')
p.chmod(0o600)
print('Generated local .env. Manager credentials stored in .env; do not commit.')
PYGEN
fi
set -a
source .env
set +a
export ASPNETCORE_ENVIRONMENT=Development
cd backend
exec dotnet run --project LogiTrack.csproj --no-launch-profile --urls http://127.0.0.1:5187
