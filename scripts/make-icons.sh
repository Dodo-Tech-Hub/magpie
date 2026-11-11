#!/usr/bin/env bash
# Builds every shipped icon from assets/magpie-icon-master.png. Run from anywhere. Needs ImageMagick (brew install imagemagick). Output is committed, so builds do not need this.
set -euo pipefail
cd "$(dirname "$0")/.."

# Set to 1 to remove the small spark by the beak from every icon (research R2).
DROP_BEAK_SPARK=0

BG='#1F1F1F'
SRC=assets/magpie-icon-master.png
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Clean copy of the master, spark optionally painted over with the background color.
if [ "$DROP_BEAK_SPARK" = 1 ]; then
  magick "$SRC" -fill "$BG" -draw 'rectangle 385,260 490,370' "$TMP/master.png"
else
  cp "$SRC" "$TMP/master.png"
fi

# Alpha mask of the art: background (#1F1F1F) becomes transparent, art (#F3F3E7) opaque.
magick "$TMP/master.png" -colorspace Gray -level 12%,95% "$TMP/mask.png"

# art COLOR SIZE CANVAS OUT: the art in one flat color, scaled to SIZE px, centered on a transparent CANVAS px square.
art() {
  magick -size 1024x1024 "xc:$1" "$TMP/mask.png" -alpha off -compose CopyAlpha -composite -compose Over \
    -colorspace sRGB -resize "$2x$2" -background none -gravity center -extent "$3x$3" -type TrueColorAlpha "PNG32:$4"
}

# iOS icon and fallback: full square, RGB, no alpha.
magick "$TMP/master.png" -background "$BG" -alpha remove -alpha off -colorspace sRGB -type TrueColor PNG24:assets/icon.png
magick assets/icon.png -resize 48x48 assets/favicon.png

# Android adaptive layers, 432 px (108 dp x4). Art is 308 px so its farthest point stays inside the 66 dp safe circle.
magick -size 432x432 "xc:$BG" PNG24:assets/android-icon-background.png
art '#F3F3E7' 308 432 assets/android-icon-foreground.png
art white 308 432 assets/android-icon-monochrome.png

# Opening screen: art on transparent, about 2/3 of the image.
art '#F3F3E7' 683 1024 assets/splash-icon.png

# Android notification small icon: white on transparent, mark about 80% of 96 px.
art white 77 96 assets/notification-icon.png
