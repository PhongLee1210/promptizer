#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
assets="$root/docs/promptizer-package-v2/assets"
package="$root/docs/promptizer-package-v2"
runtime_icons="$root/public/icon"

if ! command -v rsvg-convert > /dev/null; then
  echo "generate-icons: rsvg-convert not found; install with 'brew install librsvg'" >&2
  exit 1
fi

render() {
  local source="$1" size="$2" target="$3"
  mkdir -p "$(dirname "$target")"
  rsvg-convert --width "$size" --height "$size" --background-color none "$source" --output "$target"
}

render_box() {
  local source="$1" width="$2" height="$3" target="$4"
  mkdir -p "$(dirname "$target")"
  rsvg-convert --width "$width" --height "$height" "$source" --output "$target"
}

for state in on off backup error; do
  prefix=""
  if [ "$state" != "on" ]; then
    prefix="$state-"
  fi
  for size in 16 32 48 128; do
    render "$assets/toolbar/toolbar-$state.svg" "$size" "$runtime_icons/$prefix$size.png"
  done
done

for size in 16 32 48 128; do
  render "$assets/store/icon-tile.svg" "$size" "$package/promptizer-assets/icons/icon$size.png"
done

for size in 16 24 32; do
  render "$assets/toolbar/toolbar-on.svg" "$size" "$package/promptizer-assets/icons/action$size.png"
done

render "$assets/store/mark.svg" 512 "$package/promptizer-assets/promptizer-mark.png"

for tile in promo-small-440x280 promo-large-920x680 promo-marquee-1400x560; do
  width="${tile##*-}"
  render_box "$assets/store/$tile.svg" "${width%x*}" "${width#*x}" "$package/promptizer-assets/store/$tile.png"
done

cp "$package/promptizer-assets/icons/icon128.png" "$package/icon128.png"
cp "$package/promptizer-assets/store/promo-small-440x280.png" "$package/promo-small-440x280.png"
cp "$package/promptizer-assets/store/promo-marquee-1400x560.png" "$package/promo-marquee-1400x560.png"

echo "generate-icons: wrote runtime icons to $runtime_icons and listing assets to $package/promptizer-assets"
