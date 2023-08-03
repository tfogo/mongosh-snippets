# mongosh-snippets

Run:

```
config.set('snippetIndexSourceURLs', 'https://github.com/tfogo/mongosh-snippets/raw/main/index.bson.br;' + config.get('snippetIndexSourceURLs'))
```

Install Toff:

```
snippet refresh
snippet install toff
```

View Toff help:

```
toff.help()
```

To  auto update snippets, you can copy the contents of `.mongoshrc.js` into your `~/.mongoshrc.js`. This also sets the `inspectDepth` to infinity.