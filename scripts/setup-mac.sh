#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v dotnet >/dev/null; then echo 'Install .NET 10 SDK first'; exit 1; fi
printf 'SDK: '; dotnet --version
if ! dotnet tool list --global | grep -q dotnet-ef; then dotnet tool install --global dotnet-ef --version '10.0.*'; fi
export PATH="$PATH:$HOME/.dotnet/tools"
dotnet restore backend/LogiTrack.csproj
dotnet build backend/LogiTrack.csproj
if [ ! -d backend/Migrations ]; then dotnet ef migrations add InitialCreate --project backend/LogiTrack.csproj --startup-project backend/LogiTrack.csproj; fi
dotnet ef database update --project backend/LogiTrack.csproj --startup-project backend/LogiTrack.csproj
echo 'Setup complete. Start using: bash scripts/run-mac.sh'
