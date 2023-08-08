# Understanding the Oplog

The [oplog](https://www.mongodb.com/docs/manual/core/replica-set-oplog/) is a special collection that that keeps a rolling record of all operations that modify the data on a mongod node. It is used to drive replication in replica sets. Secondaries will read oplog entries from the primary and apply the writes to their own node. In [chained replication](https://www.mongodb.com/docs/v4.4/tutorial/manage-chained-replication/) a secondary can read the oplog from another secondary.

The oplog is a capped collection called `oplog.rs` in the `local` database. There are a few optimizations made for it in WiredTiger, and it is the only collection that doesn't include an `_id` field.

If a write does multiple operations, each will have its own oplog entry. For example, inserts with implicit collection creation create two oplog entries, one for the create and one for the insert.

Oplog entries are rewritten from the initial operation to make them idempotent; for example, updates with `$inc` are changed to use `$set`.

## `applyOps`

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
- When doing linearizable reads, to prevent reading from stale primaries, the reads block to ensure that the current node remains the primary after the read is complete. After a node reads from the most recent snapshot, it writes a noop to the oplog and waits for it to be replicated to a majority of nodes.
- 
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

#### `postImageOpTime`

#### `needsRetryImage`

#### `destinedRecipient`

#### `stmtId`

#### `fromMigrate`

#### `h`

#### `fromTenantMigration`

#### `_id`

#### `prevOpTime`

#### `t`

#### `lsid`

#### `txnNumber`

#### `txnRetryCounter`

#### `autocommit`

#### `startTransaction`

## Update format

### Idempotent Writes

## Transactions

## Common Oplog Events

### Periodic noops

## Using the oplog to debug
