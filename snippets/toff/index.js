class Oplog {
    constructor() {
        this.oplog = db.getSiblingDB("local").oplog.rs
        this.pipeline = []
        this.noop = false
        this.config = false
        this.sort = false
        this.shouldCompact = false
        this.limitNum = null
        this.projection = null
        this.options = { "allowDiskUse": true }
    }

    help() {
        print("\u001b[1m\nToff: Tim's Oplog Filtering Functions.\u001b[0m")

        print("\u001b[1m\nv2.4.0\u001b[0m")

        print("\u001b[1m\nUSAGE:\u001b[0m")
        print("\ttoff() helps printing oplog entries. Chain commands together then .show().")
        print("\tBy default noops and the config db are ommitted.")
        print("\tWhen filtering by namespace, db, command, _id, and op, we search both top-level")
        print("\toperations and sub-operations in applyOps. That way you do not miss anything")
        print("\tthat is part of a transaction.\n")

        print("\u001b[1mEXAMPLES:\u001b[0m")
        print("\tShow the oplog. By default it's in timestamp order (oldest to newest):")
        print("\t\u001b[32mtoff().show()\u001b[0m\n")

        print("\tShow the last 5 oplog entries:")
        print("\t\u001b[32mtoff().limit(5).show()\u001b[0m\n")

        print("\tShow the oplog from newest to oldest:")
        print("\t\u001b[32mtoff().reverse().show()\u001b[0m\n")

        print("\tShow the oplog from newest to oldest from timestamp { t: 1690828162, i: 786 }:")
        print("\t\u001b[32mtoff().reverse().after({ t: 1690828162, i: 786 }).show()\u001b[0m\n")

        print("\tShow the oplog from newest to oldest before timestamp { t: 1690828162, i: 786 }:")
        print("\t\u001b[32mtoff().reverse().before({ t: 1690828162, i: 786 }).show()\u001b[0m\n")

        print("\tShow the oplog between wall times \"2023-07-31T18:29:19.037889997Z\" and \"2023-07-31T18:29:19.081624304Z\":")
        print("\tNote: wall times from mongosync logs may not correspond directly to the wall times in the oplog.")
        print("\t\u001b[32mtoff().afterWall(\"2023-07-31T18:29:19.037889997Z\").beforeWall(\"2023-07-31T18:29:19.081624304Z\").show()\u001b[0m\n")

        print("\tShow only inserts into the partitions collection:")
        print("\t\u001b[32mtoff().ns(\"mongosync_reserved_for_internal_use.partitions\").op(\"i\").show()\u001b[0m\n")

        print("\tShow only createIndexes commands:")
        print("\t\u001b[32mtoff().command(\"createIndexes\").show()\u001b[0m\n")

        print("\tShow only the mongosync_reserved_for_internal_use database except for globalState:")
        print("\t\u001b[32mtoff().db(\"mongosync_reserved_for_internal_use\").excludeNs(\"globalState\").show()\u001b[0m\n")

        print("\tShow all operations on the admin.$cmd namespace:")
        print("\t\u001b[32mtoff().ns(\"admin.$cmd\").show()\u001b[0m\n")

        print("\tFind all ops in transaction 6753 for lsid.id \"d94483c0-5d07-4b05-8b9b-a0c18cc495fa\":")
        print("\t\u001b[32mtoff().txn(6753, \"d94483c0-5d07-4b05-8b9b-a0c18cc495fa\").show()\u001b[0m\n")

        print("\tFind operations on docs with _id \"64c7f9f11a4c236a31f5c6c4\":")
        print("\t\u001b[32mtoff().byID(\"64c7f9f11a4c236a31f5c6c4\").show()\u001b[0m\n")

        print("\tFind operations on docs with _id \"64c7f9f11a4c236a31f5c6c4\" or \"648170059cedcc216ef1d6d8\":")
        print("\t\u001b[32mtoff().byID(\"64c7f9f11a4c236a31f5c6c4\", \"648170059cedcc216ef1d6d8\").show()\u001b[0m\n")

        print("\tCount how many times the document with _id 8 was inserted into test.melon:")
        print("\t\u001b[32mtoff().op(\"i\").ns(\"test.melon\").byID(8).count()\u001b[0m\n")

        print("\tUse a projection to show only the timestamps for ops where _id 8 was inserted into test.melon:")
        print("\t\u001b[32mtoff().op(\"i\").ns(\"test.melon\").byID(8).project({\"ts\":1}).show()\u001b[0m\n")

        print("\tUse a custom $match query to find updates which set the field a to 10:")
        print("\t\u001b[32mtoff().op(\"u\").match({\"o.a\": 10}).show()\u001b[0m\n")

        print("\tOnly print the value of \"o._id\" for each insert on namespace foo.bar:")
        print("\t\u001b[32mtoff().op(\"i\").ns(\"foo.bar\").printField(\"o._id\")\u001b[0m\n")
        
        print("\u001b[1mREFERENCE:\u001b[0m")
        print("\t\u001b[32mincludeNoop()\u001b[0m\t\tIncludes noop operations")
        print("\t\u001b[32mincludeConfig()\u001b[0m\t\tIncludes operations from the config db")
        print("\t\u001b[32mbefore(ts)\u001b[0m\t\tOnly includes operations from a time less than or equal to the timestamp ts")
        print("\t\u001b[32mafter(ts)\u001b[0m\t\tOnly includes operations from a time greater than or equal to the timestamp ts")
        print("\t\u001b[32mbeforeWall(ts)\u001b[0m\t\tOnly includes operations from a time less than or equal to the wall time ts")
        print("\t\u001b[32mafterWall(ts)\u001b[0m\t\tOnly includes operations from a time greater than or equal to the wall time ts")
        print("\t\u001b[32mreverse()\u001b[0m\t\tEntries are sorted in descending order (newest to oldest)")
        print("\t\u001b[32mdb(db)\u001b[0m\t\t\tOnly includes operations where ns is equal to db")
        print("\t\u001b[32mns(...ns)\u001b[0m\t\tOnly includes operations from the namespace ns. You can include multiple namespaces")
        print("\t\u001b[32mexcludeDB(db)\u001b[0m\t\tExcludes operations where ns is equal to db")
        print("\t\u001b[32mexcludeNs(...ns)\u001b[0m\tExcludes operations from the namespace ns. You can exclude multiple namespaces")
        print("\t\u001b[32mop(opType)\u001b[0m\t\tOnly includes ops of type opType. Valid types are 'n','c','i','u','d'. These are noops, commands, inserts, updates, deletes.")
        print("\t\u001b[32mcommand(commandName)\u001b[0m\tOnly includes commands of type commandName")
        print("\t\u001b[32mtxn(txnNumber, lsid)\u001b[0m\tOnly includes operations with transaction number equal to txnNumber and lsid. lsid is the lsid.id UUID value in the oplog")
        print("\t\u001b[32mbyID(...ids)\u001b[0m\t\tShows operations on objects with _id equal to id. Can specify multiple ids. Includes 'i', 'u', and 'd' ops, and 'applyOps' commands")
        print("\t\u001b[32mmatch(query)\u001b[0m\t\tAdd a custom $match stage using query")
        print("\t\u001b[32mcompact()\u001b[0m\t\tWhen printing, omit most info so objects are smaller. This can omit useful information")
        print("\t\u001b[32mlimit(n)\u001b[0m\t\tLimit the output to n entries")
        print("\t\u001b[32mproject(projection)\u001b[0m\tAdd a projection to the output")
        print("\t\u001b[32mgetPipeline()\u001b[0m\t\tShows the pipeline which will be used to generate the aggregation. Useful for seeing what is happening under the hood")
        print("\t\u001b[32mcount()\u001b[0m\t\t\tInstead of showing results, print the count of results from the query")
        print("\t\u001b[32mget()\u001b[0m\t\t\tReturns the result object from the query. An alternative to show() which allows you to use the result in code if needed")
        print("\t\u001b[32mprintField(key)\u001b[0m\t\tPrints the value of the given key for each matching object. Should be used as an alternative to show()")
        print("\t\u001b[32mshow()\u001b[0m\t\t\tPrints the output from the query. Should be the final method called. Can be replaced with .get(), .count(), printField() or .getPipeline()")
    }

    includeNoop() {
        this.noop = true
        return this
    }

    includeConfig() {
        this.config = true
        return this
    }

    before(ts) {
        this.pipeline.push({"$match": {"ts": { "$lte": Timestamp(ts.t, ts.i) }}})
        return this
    }

    after(ts) {
        this.pipeline.push({"$match": {"ts": { "$gte": Timestamp(ts.t, ts.i) }}})
        return this
    }

    beforeWall(ts) {
        this.pipeline.push({"$match": {"wall": { "$lte": ISODate(ts) }}})
        return this
    }

    afterWall(ts) {
        this.pipeline.push({"$match": {"wall": { "$gte": ISODate(ts) }}})
        return this
    }

    reverse() {
        this.sort = true
        return this
    }

    db(db) {
        let match = {
            "$match": {
                "$or": [
                    {"ns": {"$regex": db+"\..*"}},
                    {"o.applyOps.ns": {"$regex": db+"\..*"}}
                ]
            }
        }

        this.pipeline.push(match)
        return this
    }

    ns(...namespaces) {
        let match = {
            "$match": {
                "$or": [
                    {"ns": {"$in": namespaces}},
                    {"o.applyOps.ns": {"$in": namespaces}},
                    {"_temp_ns": {"$in": namespaces}}
                ]
            }
        }

        this.pipeline.push(match)
        return this
    }

    excludeDB(db) {
        let match = {
            "$match": {
                "$nor": [
                    {"ns": {"$regex": db+"\..*"}},
                    {"o.applyOps.ns": {"$regex": db+"\..*"}}
                ]
            }
        }

        this.pipeline.push(match)
        return this
    }

    excludeNs(...namespaces) {
        let match = {
            "$match": {
                "$nor": [
                    {"ns": {"$in": namespaces}},
                    {"o.applyOps.ns": {"$in": namespaces}},
                    {"_temp_ns": {"$in": namespaces}}
                ]
            }
        }

        this.pipeline.push(match)
        return this
    }

    op(op) {
        let match = {
            "$match": {
                "$or": [
                    {"op": op},
                    {"o.applyOps.op": op}
                ]
            }
        }

        this.pipeline.push({"$match": {"op": op}})
        return this
    }

    command(c) {
        let fieldName = "o." + c 
        let match = {}
        match[fieldName] = {"$exists": true}
        match.op = "c"

        let matchApplyOps = {}
        let fieldNameApplyOps = "o.applyOps.o." + c 
        matchApplyOps[fieldNameApplyOps] = {"$exists": true}
        matchApplyOps["op.applyOps.op"] = "c"

        this.pipeline.push({"$match": { "$or": [match, matchApplyOps] }})
        return this
    }

    txn(txnNumber, lsid) {
        this.pipeline.push({"$match": {"txnNumber": txnNumber, "lsid.id": new UUID(lsid)}})
        return this
    }

    match(query) {
        this.pipeline.push({"$match": query})
        return this
    }

    project(projection) {
        this.projection = projection
        return this
    }

    byID(...ids) {
        ids.forEach((id, ix) => {
            if (typeof id === 'string' || id instanceof String) {
                if (id.length == 24) {
                    // assume this string should be an ObjectID
                    id = ObjectId(id)
                    ids[ix] = id
                }
            }
        })
        

        let match = {
            "$match": {
                "$or": [
                    {"o._id": {"$in": ids}},
                    {"o2._id": {"$in": ids}},
                    {"o.applyOps.o._id": {"$in": ids}},
                    {"o.applyOps.o2._id": {"$in": ids}}
                ]
            }
        }

        this.pipeline.push(match)
        return this
    }

    getPipeline() {
        let addTempNS = { "$addFields":
            {
                "_temp_ns": 
                    {
                        "$concat": [
                            {
                                $first: {$split: ["$ns", "."]}
                            }, 
                            ".", 
                            {
                                $convert: {
                                    "input": {$getField: {field: "v", input: {$first: { $objectToArray: "$$ROOT.o" }}}},
                                    "to": "string",
                                    "onError": "",
                                    "onNull": ""
                                }
                            }
                        ]
                    }
            }
        }

        this.pipeline.unshift(addTempNS)

        if (!this.config) {
            this.pipeline.unshift({"$match": {"ns": {"$not": {"$regex": "config\..*"}}}})
        }

        if (!this.noop) {
            this.pipeline.unshift({"$match": {"op": {"$ne": "n"}}})
        }

        if (this.shouldCompact) {
            let addFields = {
                "op": {"$concat": ["$op", " on ", "$ns"]}
            }

            this.pipeline.push({"$addFields": addFields})

            let projection = {
                "lsid": false,
                "txnNumber": false,
                "t": false,
                "v": false,
                "prevOpTime": false,
                "stmtId": false,
                "ui": false,
                "postImageOpTime": false,
                "wall": false,
                "ns": false
            }

            this.pipeline.push({"$project": projection})
        }

        if (this.sort) {
            this.pipeline.push({"$sort": {"ts": -1}})
        }

        if (this.limitNum) {
            this.pipeline.push({"$limit": this.limitNum})
        }

        if (this.projection) {
            this.pipeline.push({"$project": this.projection})
        }

        this.pipeline.push({"$project": {"_temp_ns": false}})

        return this.pipeline
    }

    compact() {
        this.shouldCompact = true
        return this
    }

    limit(n) {
        this.limitNum = n
        return this
    }

    show() {
        let res = this.oplog.aggregate(this.getPipeline(), this.options) 
        print(res)
    }

    get() {
        let res = this.oplog.aggregate(this.getPipeline(), this.options) 
        return res
    }

    printField(key) {
        let res = this.oplog.aggregate(this.getPipeline(), this.options) 
        
        res.forEach(e => {print(this.getNestedValue(e,key))})
    }

    getNestedValue(obj, keys) {
        let current = obj;
        const keyArray = keys.split('.');
        
        for (let key of keyArray) {
            if (current[key] === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    count() {
        let p = this.getPipeline()
        p.push({ "$count": "count" })
        let res = this.oplog.aggregate(p, this.options)
        print(res)
    }

    byTestName(testName) {
        let lookupBeforeTestTs = {
                "$lookup": {
                    "from": "oplog.rs",
                    "pipeline": [
                        {
                            "$match": {"o.test": testName, "o.hook": "before_test"}
                        },
                        {
                            "$project": {
                                "ts": 1
                            }
                        },
                        {
                            "$limit": 1
                        }
                    ],
                    "as": "before_test_ts"
                }
            }

        let lookupAfterTestTs = {
            "$lookup": {
                "from": "oplog.rs",
                "pipeline": [
                    {
                        "$match": {"o.test": testName, "o.hook": "after_test"}
                    },
                    {
                        "$project": {
                            "ts": 1
                        }
                    },
                    {
                        "$limit": 1
                    }
                ],
                "as": "after_test_ts"
            }
        }

        let matchingStage = {
            "$match": {
                "$expr": {
                    "$and": [
                        {"$gt": [
                                "$ts",
                                {
                                    "$let": {
                                        "vars": {
                                            "docExpr": {
                                                "$arrayElemAt": [
                                                    "$before_test_ts",
                                                    {
                                                        "$literal": 0
                                                    }
                                                ]
                                            }
                                        },
                                        "in": "$$docExpr.ts"
                                    }
                                }
                            ]
                        },
                        {"$lt": [
                                "$ts",
                                {
                                    "$let": {
                                        "vars": {
                                            "docExpr": {
                                                "$arrayElemAt": [
                                                    "$after_test_ts",
                                                    {
                                                        "$literal": 0
                                                    }
                                                ]
                                            }
                                        },
                                        "in": "$$docExpr.ts"
                                    }
                                }
                            ]
                        },
                    ]
                }
            }
        }

        let project = {
            "$project": {
                "before_test_ts": 0,
                "after_test_ts": 0
            }
        }

        this.pipeline.push(lookupBeforeTestTs, lookupBeforeTestTs, matchingStage, project)
        return this
    }

    explain() {
        print(this.pipeline)
    }

}

function toff() {
    return new Oplog()
}

function batchSize(n) {
    config.set("displayBatchSize", n)
}

function resetBatchSize() {
    config.reset("displayBatchSize")
}