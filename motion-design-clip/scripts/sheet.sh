#!/bin/sh
# Builds a 3 x 3 contact sheet from out/frames/t<sec>.png: sh scripts/sheet.sh out/sheet.png 1 2 3 ... (9 seconds)
out="$1"; shift
args=""; filt=""; i=0; lay=""
for t in "$@"; do
  args="$args -i out/frames/t$t.png"
  filt="$filt[$i]scale=640:360[v$i];"
  x=$(( (i % 3) * 640 )); y=$(( (i / 3) * 360 ))
  lay="$lay${lay:+|}${x}_${y}"
  i=$((i+1))
done
ins=""; j=0; while [ $j -lt $i ]; do ins="$ins[v$j]"; j=$((j+1)); done
ffmpeg -v error -y $args -filter_complex "$filt${ins}xstack=inputs=$i:layout=$lay" "$out"
