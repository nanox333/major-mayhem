#!/bin/sh
# usage: preview.sh OUTDIR "f1,f2,..." [WxH]   -> OUTDIR/sheet.png (3 columns), for looking at frames without rendering the whole scene
OUT=$1; LIST=$2; RES=${3:-640x360}
rm -rf "$OUT"; mkdir -p "$OUT"
/Applications/Blender.app/Contents/MacOS/Blender -b -P "$(dirname "$0")/noscope.py" -- --out "$OUT" --list "$LIST" --res "$RES" --samples 6 2>&1 | grep -E "Error|Traceback|RENDERED|line " 
N=$(echo "$LIST" | tr ',' '\n' | wc -l | tr -d ' ')
ROWS=$(( (N + 2) / 3 ))
ffmpeg -loglevel error -y -pattern_type glob -i "$OUT/f*.png" -vf "tile=3x$ROWS" -frames:v 1 "$OUT/sheet.png"
