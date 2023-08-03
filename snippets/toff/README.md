USAGE:
        ops() helps printing oplog entries. Chain commands together then .show().
        By default noops and the config db are ommitted.
        When filtering by namespace, db, command, _id, and op, we search both top-level
        operations and sub-operations in applyOps. That way you do not miss anything
        that is part of a transaction.

EXAMPLES:
        Show the oplog. By default it's in reverse timestamp order (newest to oldest):
        ops().show()

        Show the last 5 oplog entries:
        ops().limit(5).show()

        Show the oplog from oldest to newest:
        ops().forward().show()

        Show the oplog from oldest to newest from timestamp { t: 1690828162, i: 786 }:
        ops().forward().after({ t: 1690828162, i: 786 }).show()

        Show the oplog from oldest to newest before timestamp { t: 1690828162, i: 786 }:
        ops().forward().before({ t: 1690828162, i: 786 }).show()

        Show the oplog between wall times "2023-07-31T18:29:19.037889997Z" and "2023-07-31T18:29:19.081624304Z":
        Note: wall times from mongosync logs may not correspond directly to the wall times in the oplog.
        ops().afterWall("2023-07-31T18:29:19.037889997Z").beforeWall("2023-07-31T18:29:19.081624304Z").show()

        Show only inserts into the partitions collection:
        ops().ns("mongosync_reserved_for_internal_use.partitions").op("i").show()

        Show only createIndexes commands:
        ops().command("createIndexes").show()

        Show only the mongosync_reserved_for_internal_use database except for globalState:
        ops().db("mongosync_reserved_for_internal_use").excludeNs("globalState").show()

        Show all operations on the admin.$cmd namespace:
        ops().ns("admin.$cmd").show()

        Find all ops in transaction 6753 for lsid.id "d94483c0-5d07-4b05-8b9b-a0c18cc495fa":
        ops().txn(6753, "d94483c0-5d07-4b05-8b9b-a0c18cc495fa").show()

        Find operations on docs with _id "64c7f9f11a4c236a31f5c6c4":
        ops().byID("64c7f9f11a4c236a31f5c6c4").show()

        Count how many times the document with _id 8 was inserted into test.melon:
        ops().op("i").ns("test.melon").byID(8).count()

        Use a projection to show only the timestamps for ops where _id 8 was inserted into test.melon:
        ops().op("i").ns("test.melon").byID(8).project({"ts":1}).show()

        Use a custom $match query to find updates which set the field a to 10:
        ops().op("u").match({"o.a": 10}).show()

REFERENCE:
        includeNoop()           Includes noop operations
        includeConfig()         Includes operations from the config db
        before(ts)              Only includes operations from a time less than or equal to the timestamp ts
        after(ts)               Only includes operations from a time greater than or equal to the timestamp ts
        beforeWall(ts)          Only includes operations from a time less than or equal to the wall time ts
        afterWall(ts)           Only includes operations from a time greater than or equal to the wall time ts
        forward()               Entries are sorted in ascending order (oldest to newest)
        db(db)                  Only includes operations where ns is equal to db (does not include commands on admin.$cmd that may still impact the db)
        ns(...ns)               Only includes operations from the namespace ns. You can include multiple namespaces
        excludeDB(db)           Excludes operations where ns is equal to db (does not exclude commands on admin.$cmd that may still impact the db)
        excludeNs(...ns)        Excludes operations from the namespace ns. You can exclude multiple namespaces
        op(opType)              Only includes ops of type opType. Valid types are 'n','c','i','u','d'. These are noops, commands, inserts, updates, deletes.
        command(commandName)    Only includes commands of type commandName
        txn(txnNumber)          Only includes operations with transaction number equal to txnNumber
        byID(id)                Shows operations on objects with _id equal to id. Includes 'i', 'u', and 'd' ops, and 'applyOps' commands
        match(query)            Add a custom $match stage using query
        compact()               When printing, omit most info so objects are smaller. This can omit useful information
        limit(n)                Limit the output to n entries
        project(projection)     Add a projection to the output
        getPipeline()           Shows the pipeline which will be used to generate the aggregation. Useful for seeing what is happening under the hood
        count()                 Instead of showing results, print the count of results from the query
        show()                  Prints the output from the query. Should be the final method called. Can be replaced with .count() or .getPipeline()