# Translations

`zh_CN.po` is the Simplified Chinese catalog from
[coredevices/pebbleos-translations](https://github.com/coredevices/pebbleos-translations),
the PebbleOS language-pack sources (Apache-2.0), taken at commit
`176f944d01fae1f2b156d77f9f6fdffc9e189357` and extended: upstream leaves 341 of
its 754 entries in English, and all of those that are user-visible are
translated here, so the watch UI is fully Chinese. The 23 entries that stay as
they are are format strings (`%H:%M`, `%l:%M`, `%p`, `%A`, `%e`, …) and
separators, which must not change.

To refresh from upstream:

```bash
curl -o /tmp/zh_CN.po https://raw.githubusercontent.com/coredevices/pebbleos-translations/main/zh_CN/tintin.po
# then translate every entry whose msgstr still equals its msgid, and
msgcat --width=79 /tmp/zh_CN.po > locale/zh_CN.po
```

`build.js` copies the catalog into slot 000 of every `zh_CN` pack, replacing
only `Project-Id-Version` (with the pack version) and `Name` (with
`简体中文 + TUMBLED`). The `en_CN` packs keep the header-only catalog they have
always used, so the system falls back to its built-in English strings.

The fonts are not taken from that repository — every pack uses the TUMBLED
fonts from `fonts/`, so there is nothing else to sync.
