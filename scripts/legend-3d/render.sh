#!/bin/sh
# Render into a caller-owned working directory; never delete existing frames.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
WORK=${1:?Usage: render.sh WORK_DIRECTORY}
mkdir -p "$WORK/landscape" "$WORK/portrait" "$ROOT/public/legend"
"$BLENDER" -b -P "$ROOT/scripts/legend-3d/noscope.py" -- --out "$WORK/landscape" --res 3840x2160 --samples 32 --fps 30
"$BLENDER" -b -P "$ROOT/scripts/legend-3d/noscope.py" -- --out "$WORK/portrait" --res 1440x2560 --samples 32 --fps 30 --portrait
for layout in landscape portrait; do
  name=noscope
  if [ "$layout" = portrait ]; then name=noscope-portrait; fi
  ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$WORK/$layout/f%04d.png" -c:v libx264 -crf 16 -preset slow -vf "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p" -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -movflags +faststart -g 8 -an "$ROOT/public/legend/$name.mp4"
done
