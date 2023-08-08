# Understanding the Oplog

The [oplog](https://www.mongodb.com/docs/manual/core/replica-set-oplog/) is a special collection that that keeps a rolling record of all operations that modify the data on a mongod node. It is used to drive replication in replica sets. Secondaries will read oplog entries from the primary and apply the writes to their own node. In [chained replication](https://www.mongodb.com/docs/v4.4/tutorial/manage-chained-replication/) a secondary can read the oplog from another secondary.

The oplog is a capped collection called `oplog.rs` in the `local` database. There are a few optimizations made for it in WiredTiger, and it is the only collection that doesn't include an `_id` field.

If a write does multiple operations, each will have its own oplog entry. For example, inserts with implicit collection creation create two oplog entries, one for the create and one for the insert.

Oplog entries are rewritten from the initial operation to make them idempotent; for example, updates with `$inc` are changed to use `$set`.

## OpTime

Each oplog entry is assigned a unique OpTime to describe when it occurred so other nodes can compare how up-to-date they are.

OpTimes include a timestamp and a term field. The term field indicates how many elections have occurred since the replica set started.

The OpTime is made up of the `ts` timestamp field and the `t` term field. The timestamp is made up of a `t` field for the unix timestamp and an `i` field for an increment to differentiate ops that have the same unix timestamp.

## `applyOps`

Secondaries apply writes from oplog entries directly using a command called `applyOps` which takes an array of oplog entries. The `applyOps` command is also used to apply multi statement transactions.

## Oplog Format

The oplog format is specified in three files: 

- [src/mongo/db/repl/oplog_entry.idl](https://github.com/mongodb/mongo/blob/r6.2.0/src/mongo/db/repl/oplog_entry.idl) 
- [src/mongo/db/repl/optime_base.idl](https://github.com/mongodb/mongo/blob/r6.2.0/src/mongo/db/repl/optime_base.idl)
- [src/mongo/db/session/logical_session_id.idl](https://github.com/mongodb/mongo/blob/r6.2.0/src/mongo/db/session/logical_session_id.idl)

Here's an explanation of each field in oplog entries:

### Required Fields

#### `op`

The operation type. Valid values are:

- `"c"` - Command
- `"i"` - Insert
- `"u"` - Update
- `"d"` - Delete
- `"n"` - Noop
- `"xi"` - Insert Global Index
- `"xd"` - Delete Global Index

The `c` type is used for all commands other than `insert`, `update`, `delete`, `_shardsvrInsertGlobalIndexKey`, and `_shardsvrDeleteGlobalIndexKey`. Transactions are implemented using the `applyOps` command. So inserts, updates, and deletes that are in transactions will be in the oplog under an `applyOps` command and the top-level `op` value will be `c`.

The `n` type is used for several purposes. For example:

- Periodic noops
- `appendOplogNote`
- Linearizable reads
- Read concern majority transactions
- Elections
- Pre and post images


#### `ns`

The namespace on which to apply the operation. 

For `i`, `u`, and `d` this is simply the namespace that is being acted on.

`n` ops which are there to update the cluster time have an empty string as their `ns`. This includes periodic noop heartbeats, noops from `appendOplogNote`, noops from linearizable reads, and others.

`n` ops which contain pre-images or post-images have an `ns` equal to the namespace where the pre-images or post-images reside.

`c` ops use a special command namespace made up of the database the command is run on and the fake `$cmd` collection. For example, if you run `createIndexes` on namespace `foo.bar`, the `ns` for the oplog entry will be `foo.$cmd`. The collection being acted on will be in the command in the `o` field (`o.createIndexes` will equal `bar`). See this example: 

```js
{
    op: 'c',
    ns: 'foo.$cmd',
    ui: new UUID("c3eed117-65e0-418c-bf29-8cdcd1afc1c1"),
    o: {
        createIndexes: 'bar',
        v: 2,
        key: { 'baz': 1 },
        name: 'baz_1'
    },
    ts: Timestamp({ t: 1691008238, i: 3 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-08-02T20:30:38.225Z")
}
```

Admin commands will always have the `ns` of `admin.$cmd`. For example, `applyOps` is an admin command so will always have an `admin.$cmd` namespace even if the ops being applied act on a different namespace.


#### `o`

The object field `o` contains the operation applied. For `c` it is the command applied, for `i` it is the document inserted, for `u` it is the update applied to the document with the `_id` defined in the `o2` field, and for `d` it is the `_id` of the document to delete.


#### `v`

The version of the oplog.


#### `wall`

A wallclock time with MS resolution. E.g. `ISODate("2023-08-02T20:30:38.225Z")`.

#### `ts`

The timestamp when the oplog entry was created. E.g. `Timestamp({ t: 1691008238, i: 3 })`.


### Optional Fields

#### `tid`

The tenant ID specifies the tenant to which the operation applies.

#### `ui`

The UUID of the collection.

#### `o2`

The object2 field `o2` contains more information about the operation applied. It is most often seen in updates, where it contains the `_id` of the document to be updated. E.g:

```js
{
    op: 'u',
    ns: 'test.foo',
    ui: new UUID("461adede-1bed-492f-97e6-23a8d0655718"),
    o: { '$v': 2, diff: { i: { a: 1 } } },
    o2: { _id: ObjectId("64ce90c1cbcfddc143753651") },
    ts: Timestamp({ t: 1691259106, i: 1 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-08-05T18:11:46.936Z"),
}
```

#### `b`

This is the upsert field. If `true`, treats an update operation as an upsert. 

#### `preImageOpTime`

The opTime of the noop entry which contains the pre-image of the operation (i.e. the document from immediately before the operation was applied.)

#### `postImageOpTime`

The opTime of the noop entry which contains the pre-image of the operation (i.e. the document from immediately before the operation was applied.)

#### `needsRetryImage`

This is used to support [retryable writes for findAndModify](https://github.com/mongodb/mongo/blob/master/src/mongo/db/s/README_sessions_and_transactions.md#retryable-writes-and-findandmodify). If true, secondaries will save pre and post images into `config.image_collection`.

#### `destinedRecipient`

Used in resharding. The destined recipient for this op under the new shard key pattern.


#### `fromMigrate`

If true, this op is from a chunk migration. This allows change streams to filter out ops from chunk migrations.

#### `h`

The hash of the oplog entry. No longer used since 4.2. The term `t` removes the need for this field.

#### `fromTenantMigration`

Contains the UUID of the tenant migration for an operation caused by one.

#### `_id`

Used in resharding to store timestamps. The `_id` is not a required on the oplog and there is no `_id` index.

#### `prevOpTime`

The opTime of the previous write in the same transaction.

#### `t`

The term of the primary that created the oplog entry. The term field indicates how many elections have occurred since the replica set started.

#### `lsid`

Some operations, such as retryable writes and transactions, require durably storing metadata in the
cluster about the operation. This is done by a logical session.

A logical session is identified by its "logical session id," or `lsid`. An `lsid` includes:

- `id` - A globally unique id (UUID) generated by the mongo shell, driver, or the `startSession` server command
- `uid` (user id) - The identification information for the logged-in user (if authentication is enabled)


#### `txnNumber`

A strictly-increasing per-session counter, which indicates to which transaction of a given session does the specified command belong. The combination of lsid and txnNumber is referred to as the transaction identifier and can uniquely identify a transaction.

#### `stmtId`

A number representing an operation within a transaction or retryable write.

#### `txnRetryCounter`

A strictly-increasing per-transaction counter that starts at 0 and is incremented every time the transaction is internally retried on a transient transaction error.

#### `autocommit`

Always `false`. Reserved for future use in one shot transactions.

#### `startTransaction`

The first statement in a transaction sent with `startTransaction: true` to indicate the start of a transaction. Once a transaction is started, it remains active until it is explicitly committed or aborted by the client.

## Update format

### Idempotent Writes

Writes are converted so they are idempotent. E.g. `$inc` becomes `$set`.

### v2 update format

In 5.0 there is a new format for updates in `o` field in the oplog. Previously, the format looked like this:

```js
{
    "$set" : {
        "subObj.c" : "foo"
        "subObj.b" : "bar"
    },
    "$unset" : {
        "d" : true
    }
}
```

The ‘o’ field contained two subfields: `$set` and `$unset`. This oplog format for “partial” updates applies ‘set’ operations in alphabetical order. This means that there are some document modifications which cannot be expressed. For example, if we want to add field `b` with value `1`, then add field `a` with value `2`, in that order, we cannot use the old oplog format - field order is not preserved.

The new format does preserve field order:

```js
{
    "$v" : 2,
    "diff" : {
        // Unless otherwise specified, diffs are assumed to be ‘object’ diffs.

        // (optional) delete section.
        "d": {
            // The keys are names of fields to be deleted. The values are always
            // false (1 byte bool).
            "fieldA": false,
            "fieldB": false,
        },
        // (optional) update section
        "u": {
            // The keys are names of fields to be modified. The values represent
            // what the field should hold in the post image.
            "fieldC": "foo",
            "fieldD": {"a": 1}
        },
        // (optional) insert section
        "i": {
            // This section is structured identically to the 'update' section
            // though fields in the insert section will always be put at the end
            // of the post-image document, even if they already appear in the 
            // pre-image.
            "fieldToInsert": "new string"
        },
        // The “s” prefix indicates that this is a sub diff for field
        // “objField”:
        "sobjField": {
            // delete section
            "d": {"b": true},
            // update section
            "u": {"a": "foo"},
            // insert section
            "i": {"c": "bar"}
        },
        // Similarly, this is a sub diff for an array field.
        "sarrayField": {
            // This is an array diff.
            "a": true,
            // Length of 'arrField' in the post-image is 3.
            "l": 3,
            // Update section
            "u": {"2": "baz"}
        },
    }
}
```

Here's a real life example:

```js
{
    lsid: {
      id: new UUID("b1782e90-dbcd-4a73-a2ef-c7cb2804833e"),
      uid: Binary(Buffer.from("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "hex"), 0)
    },
    txnNumber: Long("6753"),
    op: 'u',
    ns: 'mongosync_reserved_for_internal_use.docConflict',
    ui: new UUID("74e4e340-3131-4b0c-98d9-0ce48ee0f599"),
    o: { '$v': 2, diff: { u: { conflictCounter: 4551 } } },
    o2: { _id: { db: 'test', coll: 'melon', docID: 1 } },
    ts: Timestamp({ t: 1690828162, i: 749 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-07-31T18:29:22.608Z"),
    stmtId: 0,
    prevOpTime: { ts: Timestamp({ t: 0, i: 0 }), t: Long("-1") },
    postImageOpTime: { ts: Timestamp({ t: 1690828162, i: 748 }), t: Long("1") }
}
```

For more information on the new format see [Design: Shrink the generated oplog entries from pipeline-style updates](https://docs.google.com/document/d/1sxGrck8X0r0W37UVLFwV8vaUQv3OM8xlyWWvHB5M2ew/edit).

## Transactions

Example of an applyOps oplog entry generated by a multi-statement transaction:

```js
{
    lsid: {
        id: new UUID("a6b4ca9a-37e2-4e6b-ae41-1d2acc9fb0e0"),
        uid: Binary(Buffer.from("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "hex"), 0)
    },
    txnNumber: Long("6795"),
    op: 'c',
    ns: 'admin.$cmd',
    o: {
        applyOps: [
        {
            op: 'd',
            ns: 'test.apple',
            ui: new UUID("7d31a725-7b6d-4f07-bb80-6f066f90ee3a"),
            o: { _id: 19 }
        },
        {
            op: 'i',
            ns: 'test.apple',
            ui: new UUID("7d31a725-7b6d-4f07-bb80-6f066f90ee3a"),
            o: { _id: 19, partIndex: 9, ticker: 'T2', price: 490 }
        }
        ]
    },
    ts: Timestamp({ t: 1690828162, i: 784 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-07-31T18:29:22.642Z"),
    prevOpTime: { ts: Timestamp({ t: 0, i: 0 }), t: Long("-1") }
}
```

Transactions split across multiple oplog entries (such as prepared transactions) will start with an oplog entry with `startTransaction: true`. Subsequent entries will have the same `lsid` and `txnNumber` pair and will reference the opTime of the previous entry in `prevOpTime`. Eventually there will be a `commitTransaction` or `abortTransaction` oplog entry. e.g.

```js
{	
    “ts” : Timestamp(1515616500, 1),
    "t"  : NumberLong(1),
    "h"  : NumberLong("-3432296152570818373"),
    "v"  : 2,
    "op" : "c",
    "ns" : "test.$cmd",
    "o"  : {commitTransaction: 1, commitTimestamp: Timestamp(1515616400, 1)},
    “lsid”: {
        id: new UUID("a6b4ca9a-37e2-4e6b-ae41-1d2acc9fb0e0"),
        uid: Binary(Buffer.from("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "hex"), 0)
    },
    “txnNumber”: NumberLong(“5”),
    “prevOpTime”: { ts: Timestamp(1515616300, 1), t: NumberLong(1)}
}
```

References: 

- [Design: Single Replica Set Transactions](https://docs.google.com/document/d/1xCeDgjGZSJafZJ66cLVDX7aI4PEqMtwl2p6kDNAAp1c/edit)
- [Technical Design: Prepare support for transactions](https://docs.google.com/document/d/1WdMcgebvDiU9xzi37xemLqLWYo17eMGSyaUZ-gZ_RXc/edit)

## Exploring the oplog with Toff

Show all oplog entries:

```
toff().show()
```

Let's look at all inserts:

```
toff().op("i").show()
```

We see inserts like this:

```js
{
    op: 'i',
    ns: 'test.mango',
    ui: new UUID("5d9270ff-f42a-4312-9754-cfaa65501a30"),
    o: { _id: 1, val: 'B', caseSensitiveColl: false },
    ts: Timestamp({ t: 1690827246, i: 3 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-07-31T18:14:06.074Z")
}
```

And we see inserts with session and txn info (these are retryable writes):

```js
{
    lsid: {
      id: new UUID("71a12500-9cd8-4041-821c-dd29f75c09e6"),
      uid: Binary(Buffer.from("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "hex"), 0)
    },
    txnNumber: Long("14"),
    op: 'i',
    ns: 'mongosync_reserved_for_internal_use.statistics',
    ui: new UUID("29f6e3dc-4450-4983-a495-4020960a4a5e"),
    o: {
      _id: {
        id: 'coordinator',
        uuid: new UUID("98f37c86-d042-4199-ac87-d128ecee77b0"),
        fieldName: 'collectionStats'
      },
      estimatedTotalBytes: Long("156"),
      estimatedCopiedBytes: Long("0"),
      numSrcIndexes: 1
    },
    ts: Timestamp({ t: 1690827245, i: 18 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-07-31T18:14:05.800Z"),
    stmtId: 0,
    prevOpTime: { ts: Timestamp({ t: 0, i: 0 }), t: Long("-1") }
}
```

Now let's take a look at updates

```js
toff().op("u").show()
```

Now let's take a look at deletes

```js
toff().op("d").show()
```

Now let's take a look at commands

```js
toff().op("c").show()
```

Notice the namespace is on `test.$cmd`:

```js
{
    op: 'c',
    ns: 'test.$cmd',
    ui: new UUID("5d9270ff-f42a-4312-9754-cfaa65501a30"),
    o: {
      create: 'mango',
      idIndex: { v: 2, key: { _id: 1 }, name: '_id_' }
    },
    ts: Timestamp({ t: 1690827245, i: 17 }),
    t: Long("1"),
    v: Long("2"),
    wall: ISODate("2023-07-31T18:14:05.791Z")
}
```

Toff can correctly find commands that act on specific namespaces: 

```js
toff().op("c").ns("test.mango").show()
```

Let's find all `applyOps` commands (these are probably all transactions):

```js
toff().command("applyOps").show()
```

We can also correctly find transactions on specific namespaces:

```js
toff().command("applyOps").ns("test.apple").show()
```

If we want to find a specific transaction:

```js
toff().txn(6795, "a6b4ca9a-37e2-4e6b-ae41-1d2acc9fb0e0").show()
```

If we want to find ops on a specific document:

```js
toff().byID(18).ns("test.apple").show()
```

If we want to look at noops:

```js
toff().includeNoop().op("n").show()
toff().includeNoop().op("n").excludeDB("mongosync_reserved_for_internal_use").show()
```