#!/bin/sh
# Builds the plugin zip for an LMS repository. Usage: scripts/release.sh <base URL the zip will be served from>
# Writes dist/Squire-<version>.zip and dist/repo.xml; publish both, then add the repo.xml URL in LMS settings.
set -eu

base_url=${1:?usage: scripts/release.sh <base URL>}
version=$(node -p "require('./package.json').version")
plugin_version=$(sed -n 's:.*<version>\(.*\)</version>.*:\1:p' plugin/Squire/install.xml)
if [ "$version" != "$plugin_version" ]; then
  echo "package.json is $version but install.xml is $plugin_version" >&2
  exit 1
fi

pnpm build
mkdir -p dist
zip_name="Squire-$version.zip"
rm -f "dist/$zip_name"
(cd plugin && zip -qr "../dist/$zip_name" Squire -x '*.DS_Store')
sha=$(shasum "dist/$zip_name" | cut -d' ' -f1)

cat > dist/repo.xml <<XML
<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<extensions>
  <details>
    <title lang="EN">Squire</title>
  </details>
  <plugins>
    <plugin name="Squire" version="$version" minTarget="8.0.0" maxTarget="*">
      <title lang="EN">Squire</title>
      <desc lang="EN">A mobile-first web skin</desc>
      <creator>Richard Nesnass</creator>
      <url>${base_url%/}/$zip_name</url>
      <sha>$sha</sha>
    </plugin>
  </plugins>
</extensions>
XML

echo "dist/$zip_name  sha1 $sha"
echo "dist/repo.xml"
