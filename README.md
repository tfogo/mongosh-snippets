# Toff: Tim's Oplog Filtering Functions

![Bertie Wooster](bertie.gif)

The `toff()` method helps printing oplog entries. Chain commands together to filter oplog entries then `.show()`. By default noops and the config db are ommitted. When filtering by namespace, db, command, _id, and op, we search both top-level operations and sub-operations in applyOps. That way you do not miss anything that is part of a transaction. When filtering by namespace we take into account commands on `db.$cmd`.

## Installation

Run `mongosh`. Then in the `mongosh` shell run the following commands:

```js
config.set('snippetIndexSourceURLs', 'https://github.com/tfogo/mongosh-snippets/raw/main/index.bson.br;' + config.get('snippetIndexSourceURLs'))
```

Install the Toff snippet:

```
snippet refresh
snippet install toff
```

I recommend setting `inspectDepth` to Infinity to make sure nested oplog entries are fully parsed. If this causes problems with parsing extremely nested documents you can always set it to a finite number. 

```js
config.set("inspectDepth", Infinity)
```

View Toff help:

```js
toff().help()
```

Updating toff:

```
snippet update toff
snippet load-all
```

## Tips

Want to look at results one at a time? Set batchSize to 1, then you can iterate through the results with `it`. After you're done you can reset the batch size:

```js
config.set("displayBatchSize", 1)

toff().show()

// Iterate through results with it

config.reset("displayBatchSize")
```

## Examples

Show the oplog. By default it's in timestamp order (oldest to newest):
```js
toff().show()
```
<br />

Show the last 5 oplog entries:
```js
toff().limit(5).show()
```
<br />

Show the oplog from newest to oldest:
```js
toff().reverse().show()
```
<br />

Show the oplog from newest to oldest from timestamp `{ t: 1690828162, i: 786 }`:
```js
toff().reverse().after({ t: 1690828162, i: 786 }).show()
```
<br />

Show the oplog from newest to oldest before timestamp `{ t: 1690828162, i: 786 }`:
```js
toff().reverse().before({ t: 1690828162, i: 786 }).show()
```
<br />

Show the oplog between wall times `"2023-07-31T18:29:19.037889997Z"` and `"2023-07-31T18:29:19.081624304Z"`:

Note: wall times from mongosync logs may not correspond directly to the wall times in the oplog.
```js
toff().afterWall("2023-07-31T18:29:19.037889997Z").beforeWall("2023-07-31T18:29:19.081624304Z").show()
```
<br />

Show only inserts into the `partitions` collection:
```js
toff().ns("mongosync_reserved_for_internal_use.partitions").op("i").show()
```
<br />

Show only `createIndexes` commands:
```js
toff().command("createIndexes").show()
```
<br />

Show only the `mongosync_reserved_for_internal_use` database except for globalState:
```js
toff().db("mongosync_reserved_for_internal_use").excludeNs("globalState").show()
```
<br />

Show all operations on the admin.$cmd namespace:
```js
toff().ns("admin.$cmd").show()
```
<br />

Find all ops in transaction `6753` for lsid.id `"d94483c0-5d07-4b05-8b9b-a0c18cc495fa"`:
```js
toff().txn(6753, "d94483c0-5d07-4b05-8b9b-a0c18cc495fa").show()
```
<br />

Find operations on docs with _id `"64c7f9f11a4c236a31f5c6c4"`:
```js
toff().byID("64c7f9f11a4c236a31f5c6c4").show()
```
<br />

Count how many times the document with _id 8 was inserted into test.melon:
```js
toff().op("i").ns("test.melon").byID(8).count()
```
<br />

Use a projection to show only the timestamps for ops where _id 8 was inserted into test.melon:
```js
toff().op("i").ns("test.melon").byID(8).project({"ts":1}).show()
```
<br />


Use a custom $match query to find updates which set the field a to 10:
```js
toff().op("u").match({"o.a": 10}).show()
```
<br />

## Reference

`includeNoop()`           
Includes noop operations
<br />
 
`includeConfig()`         
Includes operations from the config db
<br />
 
`before(ts)`              
Only includes operations from a time less than or equal to the timestamp ts
<br />
 
`after(ts)`               
Only includes operations from a time greater than or equal to the timestamp ts
<br />
 
`beforeWall(ts)`          
Only includes operations from a time less than or equal to the wall time ts
<br />
 
`afterWall(ts)`           
Only includes operations from a time greater than or equal to the wall time ts
<br />
 
`reverse()`               
Entries are sorted in descending order (newest to oldest)
<br />
 
`db(db)`                  
Only includes operations where ns is equal to db
<br />
 
`ns(...ns)`               
Only includes operations from the namespace ns. You can include multiple namespaces
<br />
 
`excludeDB(db)`           
Excludes operations where ns is equal to db
<br />
 
`excludeNs(...ns)`        
Excludes operations from the namespace ns. You can exclude multiple namespaces
<br />
 
`op(opType)`              
Only includes ops of type opType. Valid types are 'n','c','i','u','d'. These are noops, commands, inserts, updates, deletes.
<br />
 
`command(commandName)`    
Only includes commands of type commandName
<br />
 
`txn(txnNumber, lsid)`          
Only includes operations with transaction number equal to txnNumber and lsid. lsid is the lsid.id UUID value in the oplog
<br />
 
`byID(id)`                
Shows operations on objects with _id equal to id. Includes 'i', 'u', and 'd' ops, and 'applyOps' commands
<br />
 
`match(query)`            
Add a custom $match stage using query
<br />
 
`compact()`               
When printing, omit most info so objects are smaller. This can omit useful information
<br />
 
`limit(n)`                
Limit the output to n entries
<br />
 
`project(projection)`     
Add a projection to the output
<br />
 
`getPipeline()`          
Shows the pipeline which will be used to generate the aggregation. Useful for seeing what is happening under the hood
<br />
 
`count()`                 
Instead of showing results, print the count of results from the query
<br />
 
`show()`                  
Prints the output from the query. Should be the final method called. Can be replaced with .count() or .getPipeline()
<br />
 
