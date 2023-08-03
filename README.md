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

I recommend setting `config.set("inspectDepth", Infinity)` to make sure nested oplog entries are fully parsed. If this causes problems with parsing extremely nested documents you can always set it to a finite number. 