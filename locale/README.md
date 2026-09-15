# Translations

`zh_CN.po` is the Simplified Chinese catalog from
[coredevices/pebbleos-translations](https://github.com/coredevices/pebbleos-translations),
the PebbleOS language-pack sources, taken verbatim at commit
`176f944d01fae1f2b156d77f9f6fdffc9e189357` (Apache-2.0).

`build.js` copies it into slot 000 of every `zh_CN` pack, replacing only
`Project-Id-Version` (with the pack version) and `Name` (with
`简体中文 + TUMBLED`). The `en_CN` packs keep the header-only catalog they
have always used, so the system falls back to its built-in English strings.

To pick up a newer catalog:

```bash
curl -o locale/zh_CN.po https://raw.githubusercontent.com/coredevices/pebbleos-translations/main/zh_CN/tintin.po
```

The fonts are not taken from that repository — every pack uses the TUMBLED
fonts from `fonts/`, so there is nothing else to sync.
