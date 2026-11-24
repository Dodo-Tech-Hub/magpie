#!/usr/bin/env bash
# Access check for Apple Music (research R1). Run on a TEST account only.
# Usage: DT=<developer token> UT=<music user token> SONG=<song id> ARTIST=<artist id> ./verify-access.sh
# SONG: the number after ?i= in a music.apple.com song link. ARTIST: the number at the end of an artist link.
# Get UT from the bridge page in check mode (contracts/sign-in-bridge.md).
# Prints status codes and short facts only, never a token.
set -euo pipefail
: "${DT:?set DT to the developer token}"
: "${UT:?set UT to the music user token}"
: "${SONG:?set SONG to a song id}"
: "${ARTIST:?set ARTIST to an artist id}"
API=https://api.music.apple.com
H=(-H "Authorization: Bearer $DT" -H "Music-User-Token: $UT")
code() { curl -s -o /tmp/am.json -w '%{http_code}' "${H[@]}" "$@"; }

echo "1. Storefront: $(code "$API/v1/me/storefront")"
echo "2. Library songs: $(code "$API/v1/me/library/songs?limit=5&include=catalog")"
echo "3. Library playlists: $(code "$API/v1/me/library/playlists?limit=5")"
echo "4. Add a song: $(code -X POST "$API/v1/me/library?ids%5Bsongs%5D=$SONG")"
echo "5. Make playlist 'magpie-test': $(code -X POST -H 'Content-Type: application/json' -d '{"attributes":{"name":"magpie-test"}}' "$API/v1/me/library/playlists")"
PL=$(sed -n 's/.*"id":"\(p\.[^"]*\)".*/\1/p' /tmp/am.json | head -1)
if [ -n "$PL" ]; then
  echo "5b. Add the song to it: $(code -X POST -H 'Content-Type: application/json' -d "{\"data\":[{\"id\":\"$SONG\",\"type\":\"songs\"}]}" "$API/v1/me/library/playlists/$PL/tracks")"
fi
echo "6a. Read favorites: $(code "$API/v1/me/favorites?limit=5")"
echo "6b. Add favorite artist: $(code -X POST "$API/v1/me/favorites?ids%5Bartists%5D=$ARTIST")"
echo "7. Social profile: $(code "$API/v1/me/social-profile")"
rm -f /tmp/am.json
