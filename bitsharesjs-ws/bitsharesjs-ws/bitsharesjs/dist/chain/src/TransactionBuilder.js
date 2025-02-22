"use strict";

exports.__esModule = true;

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _ecc = require("../../ecc");

var _serializer = require("../../serializer");

var _bitsharesjsWs = require("bitsharesjs-ws");

var _ChainTypes = require("./ChainTypes");

var _ChainTypes2 = _interopRequireDefault(_ChainTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var head_block_time_string, committee_min_review;

var TransactionBuilder = function () {
    function TransactionBuilder() {
        _classCallCheck(this, TransactionBuilder);

        this.ref_block_num = 0;
        this.ref_block_prefix = 0;
        this.expiration = 0;
        this.operations = [];
        this.signatures = [];
        this.signer_private_keys = [];

        // semi-private method bindings
        this._broadcast = _broadcast.bind(this);
    }

    /**
        @arg {string} name - like "transfer"
        @arg {object} operation - JSON matchching the operation's format
    */


    TransactionBuilder.prototype.add_type_operation = function add_type_operation(name, operation) {
        this.add_operation(this.get_type_operation(name, operation));
        return;
    };

    /**
        This does it all: set fees, finalize, sign, and broadcast (if wanted).
         @arg {ConfidentialWallet} cwallet - must be unlocked, used to gather signing keys
         @arg {array<string>} [signer_pubkeys = null] - Optional ["GPHAbc9Def0...", ...].  These are additional signing keys.  Some balance claims require propritary address formats, the witness node can't tell us which ones are needed so they must be passed in.  If the witness node can figure out a signing key (mostly all other transactions), it should not be passed in here.
         @arg {boolean} [broadcast = false]
    */


    TransactionBuilder.prototype.process_transaction = function process_transaction(cwallet) {
        var _this = this;

        var signer_pubkeys = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
        var broadcast = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var wallet_object = cwallet.wallet.wallet_object;
        if (_bitsharesjsWs.Apis.instance().chain_id !== wallet_object.get("chain_id")) return Promise.reject("Mismatched chain_id; expecting " + wallet_object.get("chain_id") + ", but got " + _bitsharesjsWs.Apis.instance().chain_id);

        return this.set_required_fees().then(function () {
            var signer_pubkeys_added = {};
            if (signer_pubkeys) {
                // Balance claims are by address, only the private
                // key holder can know about these additional
                // potential keys.
                var pubkeys = cwallet.getPubkeys_having_PrivateKey(signer_pubkeys);
                if (!pubkeys.length) throw new Error("Missing signing key");

                for (var _iterator = pubkeys, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                    var _ref;

                    if (_isArray) {
                        if (_i >= _iterator.length) break;
                        _ref = _iterator[_i++];
                    } else {
                        _i = _iterator.next();
                        if (_i.done) break;
                        _ref = _i.value;
                    }

                    var pubkey_string = _ref;

                    var private_key = cwallet.getPrivateKey(pubkey_string);
                    _this.add_signer(private_key, pubkey_string);
                    signer_pubkeys_added[pubkey_string] = true;
                }
            }

            return _this.get_potential_signatures().then(function (_ref2) {
                var pubkeys = _ref2.pubkeys,
                    addys = _ref2.addys;

                var my_pubkeys = cwallet.getPubkeys_having_PrivateKey(pubkeys, addys);

                //{//Testing only, don't send All public keys!
                //    var pubkeys_all = PrivateKeyStore.getPubkeys() // All public keys
                //    this.get_required_signatures(pubkeys_all).then( required_pubkey_strings =>
                //        console.log('get_required_signatures all\t',required_pubkey_strings.sort(), pubkeys_all))
                //    this.get_required_signatures(my_pubkeys).then( required_pubkey_strings =>
                //        console.log('get_required_signatures normal\t',required_pubkey_strings.sort(), pubkeys))
                //}

                return _this.get_required_signatures(my_pubkeys).then(function (required_pubkeys) {
                    for (var _iterator2 = required_pubkeys, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
                        var _ref3;

                        if (_isArray2) {
                            if (_i2 >= _iterator2.length) break;
                            _ref3 = _iterator2[_i2++];
                        } else {
                            _i2 = _iterator2.next();
                            if (_i2.done) break;
                            _ref3 = _i2.value;
                        }

                        var _pubkey_string = _ref3;

                        if (signer_pubkeys_added[_pubkey_string]) continue;
                        var private_key = cwallet.getPrivateKey(_pubkey_string);
                        if (!private_key)
                            // This should not happen, get_required_signatures will only
                            // returned keys from my_pubkeys
                            throw new Error("Missing signing key for " + _pubkey_string);
                        _this.add_signer(private_key, _pubkey_string);
                    }
                });
            }).then(function () {
                return broadcast ? _this.broadcast() : _this.serialize();
            });
        });
    };

    /** Typically this is called automatically just prior to signing.  Once finalized this transaction can not be changed. */


    TransactionBuilder.prototype.finalize = function finalize() {
        var _this2 = this;

        return new Promise(function (resolve, reject) {
            if (_this2.tr_buffer) {
                throw new Error("already finalized");
            }

            resolve(_bitsharesjsWs.Apis.instance().db_api().exec("get_objects", [["2.1.0"]]).then(function (r) {
                head_block_time_string = r[0].time;
                if (_this2.expiration === 0) _this2.expiration = base_expiration_sec() + _bitsharesjsWs.ChainConfig.expire_in_secs;
                _this2.ref_block_num = r[0].head_block_number & 0xffff;
                _this2.ref_block_prefix = new Buffer(r[0].head_block_id, "hex").readUInt32LE(4);
                //DEBUG console.log("ref_block",@ref_block_num,@ref_block_prefix,r)

                var iterable = _this2.operations;
                for (var i = 0, op; i < iterable.length; i++) {
                    op = iterable[i];
                    if (op[1]["finalize"]) {
                        op[1].finalize();
                    }
                }
                _this2.tr_buffer = _serializer.ops.transaction.toBuffer(_this2);
            }));
        });
    };

    /** @return {string} hex transaction ID */


    TransactionBuilder.prototype.id = function id() {
        if (!this.tr_buffer) {
            throw new Error("not finalized");
        }
        return _ecc.hash.sha256(this.tr_buffer).toString("hex").substring(0, 40);
    };

    /**
        Typically one will use {@link this.add_type_operation} instead.
        @arg {array} operation - [operation_id, operation]
    */


    TransactionBuilder.prototype.add_operation = function add_operation(operation) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        (0, _assert2.default)(operation, "operation");
        if (!Array.isArray(operation)) {
            throw new Error("Expecting array [operation_id, operation]");
        }
        this.operations.push(operation);
        return;
    };

    TransactionBuilder.prototype.get_type_operation = function get_type_operation(name, operation) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        (0, _assert2.default)(name, "name");
        (0, _assert2.default)(operation, "operation");
        var _type = _serializer.ops[name];
        (0, _assert2.default)(_type, "Unknown operation " + name);
        var operation_id = _ChainTypes2.default.operations[_type.operation_name];
        if (operation_id === undefined) {
            throw new Error("unknown operation: " + _type.operation_name);
        }
        if (!operation.fee) {
            operation.fee = { amount: 0, asset_id: 0 };
        }
        if (name === "proposal_create") {
            /*
            * Proposals involving the committee account require a review
            * period to be set, look for them here
            */
            var requiresReview = false,
                extraReview = 0;
            operation.proposed_ops.forEach(function (op) {
                var COMMITTE_ACCOUNT = 0;
                var key = void 0;

                switch (op.op[0]) {
                    case 0:
                        // transfer
                        key = "from";
                        break;

                    case 6: //account_update
                    case 17:
                        // asset_settle
                        key = "account";
                        break;

                    case 10: // asset_create
                    case 11: // asset_update
                    case 12: // asset_update_bitasset
                    case 13: // asset_update_feed_producers
                    case 14: // asset_issue
                    case 18: // asset_global_settle
                    case 43:
                        // asset_claim_fees
                        key = "issuer";
                        break;

                    case 15:
                        // asset_reserve
                        key = "payer";
                        break;

                    case 16:
                        // asset_fund_fee_pool
                        key = "from_account";
                        break;

                    case 22: // proposal_create
                    case 23: // proposal_update
                    case 24:
                        // proposal_delete
                        key = "fee_paying_account";
                        break;

                    case 31:
                        // committee_member_update_global_parameters
                        requiresReview = true;
                        extraReview = 60 * 60 * 24 * 13; // Make the review period 2 weeks total
                        break;
                }
                if (key in op.op[1] && op.op[1][key] === COMMITTE_ACCOUNT) {
                    requiresReview = true;
                }
            });
            operation.expiration_time || (operation.expiration_time = base_expiration_sec() + _bitsharesjsWs.ChainConfig.expire_in_secs_proposal);
            if (requiresReview) {
                operation.review_period_seconds = extraReview + Math.max(committee_min_review, 24 * 60 * 60 || _bitsharesjsWs.ChainConfig.review_in_secs_committee);
                /*
                * Expiration time must be at least equal to
                * now + review_period_seconds, so we add one hour to make sure
                */
                operation.expiration_time += 60 * 60 + extraReview;
            }
        }
        var operation_instance = _type.fromObject(operation);
        return [operation_id, operation_instance];
    };

    /* optional: fetch the current head block */

    TransactionBuilder.prototype.update_head_block = function update_head_block() {
        return Promise.all([_bitsharesjsWs.Apis.instance().db_api().exec("get_objects", [["2.0.0"]]), _bitsharesjsWs.Apis.instance().db_api().exec("get_objects", [["2.1.0"]])]).then(function (res) {
            var g = res[0],
                r = res[1];

            head_block_time_string = r[0].time;
            committee_min_review = g[0].parameters.committee_proposal_review_period;
        });
    };

    /** optional: there is a deafult expiration */


    TransactionBuilder.prototype.set_expire_seconds = function set_expire_seconds(sec) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        return this.expiration = base_expiration_sec() + sec;
    };

    /* Wraps this transaction in a proposal_create transaction */


    TransactionBuilder.prototype.propose = function propose(proposal_create_options) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        if (!this.operations.length) {
            throw new Error("add operation first");
        }

        (0, _assert2.default)(proposal_create_options, "proposal_create_options");
        (0, _assert2.default)(proposal_create_options.fee_paying_account, "proposal_create_options.fee_paying_account");

        var proposed_ops = this.operations.map(function (op) {
            return { op: op };
        });

        this.operations = [];
        this.signatures = [];
        this.signer_private_keys = [];
        proposal_create_options.proposed_ops = proposed_ops;
        this.add_type_operation("proposal_create", proposal_create_options);
        return this;
    };

    TransactionBuilder.prototype.has_proposed_operation = function has_proposed_operation() {
        var hasProposed = false;
        for (var i = 0; i < this.operations.length; i++) {
            if ("proposed_ops" in this.operations[i][1]) {
                hasProposed = true;
                break;
            }
        }

        return hasProposed;
    };

    /** optional: the fees can be obtained from the witness node */


    TransactionBuilder.prototype.set_required_fees = function set_required_fees(asset_id, removeDuplicates) {
        var _this3 = this;

        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        if (!this.operations.length) {
            throw new Error("add operations first");
        }

        function isProposal(op) {
            return op[0] === 22;
        }

        var operations = [];
        var proposed_ops = [];
        var feeAssets = [];
        var proposalFeeAssets = [];
        var potentialDuplicates = {};
        function getDuplicateOriginalIndex(op, index) {
            var key = getOperationKey(op);
            var duplicate = potentialDuplicates[key];
            if (!!duplicate) {
                if (duplicate.original === index) return index;else if (duplicate.duplicates.indexOf(index) !== -1) {
                    return duplicate.original;
                }
            }
        }
        function getOperationKey(op) {
            var key = null;
            switch (op[0]) {
                case 0:
                    // transfer
                    var memoDummy = new Array(op[1].memo.message.length + 1).join("a");
                    key = op[0] + "_" + op[1].amount.asset_id + "_" + memoDummy;
                    break;
                default:
            }
            return key;
        }
        for (var i = 0, op; i < this.operations.length; i++) {
            op = this.operations[i];
            var opObject = _serializer.ops.operation.toObject(op);
            var isDuplicate = false;
            if (removeDuplicates) {
                var key = getOperationKey(opObject);
                if (key) {
                    if (!potentialDuplicates[key]) potentialDuplicates[key] = {
                        original: i,
                        duplicates: []
                    };else {
                        potentialDuplicates[key].duplicates.push(i);
                        isDuplicate = true;
                    }
                }
            }
            /*
            * If the operation creates a proposal, we should check the fee pool
            * of the suggested proposal fee assets to prevent users from creating
            * proposals that will most likely fail due to empty fee pools
            */
            if (isProposal(op)) {
                op[1].proposed_ops.forEach(function (prop) {
                    // console.log("proposed op", prop.op[1].fee);
                    proposed_ops.push(prop);
                    if (proposalFeeAssets.indexOf(prop.op[1].fee.asset_id) === -1) proposalFeeAssets.push("1.3." + prop.op[1].fee.asset_id);
                });
            }
            if (!isDuplicate) {
                operations.push(opObject);
                if (feeAssets.indexOf(operations[i][1].fee.asset_id) === -1) feeAssets.push(operations[i][1].fee.asset_id);
            }
        }

        if (!asset_id) {
            var op1_fee = operations[0][1].fee;
            if (op1_fee && op1_fee.asset_id !== null) {
                asset_id = op1_fee.asset_id;
            } else {
                asset_id = "1.3.0";
            }
        }

        var promises = [];
        promises.push(Promise.all(feeAssets.map(function (id) {
            return _bitsharesjsWs.Apis.instance().db_api().exec("get_required_fees", [operations, id]);
        })).catch(function (err) {
            console.error("get_required_fees API error: ", err.message);
        }));

        /*
        * Add the proposal fee asset ids to feeAssets here to fetch their
        * dynamic objects without calling get_required_fees with them as well
        */
        if (proposalFeeAssets.length) {
            proposalFeeAssets.forEach(function (id) {
                if (feeAssets.indexOf(id) === -1) feeAssets.push(id);
            });
        }

        if (feeAssets.length > 1 || feeAssets[0] !== "1.3.0") {
            /*
            * If we're paying with any assets other than CORE, we need to fetch
            * the dynamic asset object and check the fee pool of those assets.
            * The dynamic asset object id is equal to the asset id but with
            * 2.3.x instead of 1.3.x
            */
            var dynamicObjectIds = feeAssets.map(function (a) {
                return a.replace(/^1\./, "2.");
            });
            promises.push(_bitsharesjsWs.Apis.instance().db_api().exec("get_required_fees", [operations, "1.3.0"]));
            promises.push(_bitsharesjsWs.Apis.instance().db_api().exec("get_objects", [dynamicObjectIds]));
        }

        return Promise.all(promises).then(function (results) {
            /*
            * allFees and coreFees are arrays containg fee amounts grouped by
            * asset and for each operation in operations
            */
            var allFees = results[0],
                coreFees = results[1],
                dynamicObjects = results[2];
            /*
            * If one of the desired fee assets has an invalid core exchange rate
            * get_required_signatures will fail and the result for all assets
            * will be undefined, if so we just default to coreFees
            */

            if (allFees === undefined) {
                allFees = coreFees;
            }
            /*
            * If the only desired fee asset is CORE, coreFees are not fetched
            * but are equal to allFees
            */
            if (!coreFees) {
                coreFees = allFees[0];
            }

            /* Create a map of fees and proposal fees by asset id */
            var feesByAsset = {};
            var proposalFeesByAsset = {};
            allFees.forEach(function (feeSet) {
                var filteredFeeSet = feeSet.map(function (f) {
                    if (Array.isArray(f)) {
                        // This operation includes a proposal
                        proposalFeesByAsset[f[1][0].asset_id] = f[1];
                        return f[0];
                    }
                    return f;
                });
                var currentAssetId = filteredFeeSet[0].asset_id;

                feesByAsset[currentAssetId] = filteredFeeSet;
            }, {});

            /* Create a map of fee pools by asset id*/
            var feePoolMap = !!dynamicObjects ? dynamicObjects.reduce(function (map, object) {
                map[object.id.replace(/^2\./, "1.")] = object;
                return map;
            }, {}) : {};

            var feeMap = {};
            var proposalFeeMap = {};
            function updateFeeMap(map, asset_id, opIndex, core_fees) {
                if (!map[asset_id]) map[asset_id] = { total: 0, ops: [] };
                if (map[asset_id].propIdx) map[asset_id].propIdx.push(opIndex);else map[asset_id].ops.push(opIndex);

                if (asset_id !== "1.3.0") {
                    map[asset_id].total += core_fees.length ? core_fees[opIndex].amount : core_fees.amount;
                }
                return map;
            }

            var _loop = function _loop(_i3) {
                var op = operations[_i3];
                var feeAssetId = op[1].fee.asset_id;

                if (isProposal(op)) {
                    feeMap = updateFeeMap(feeMap, feeAssetId, _i3, coreFees[_i3][0]);

                    op[1].proposed_ops.forEach(function (prop, y) {
                        var propFeeAsset = prop.op[1].fee.asset_id;
                        if (!proposalFeeMap[_i3]) proposalFeeMap[_i3] = {};
                        if (!proposalFeeMap[_i3][propFeeAsset]) proposalFeeMap[_i3][propFeeAsset] = {
                            total: 0,
                            ops: [_i3],
                            propIdx: []
                        };

                        proposalFeeMap[_i3] = updateFeeMap(proposalFeeMap[_i3], propFeeAsset, y, coreFees[_i3][1]);
                    });
                } else {
                    feeMap = updateFeeMap(feeMap, feeAssetId, _i3, coreFees[_i3]);
                }
            };

            for (var _i3 = 0; _i3 < operations.length; _i3++) {
                _loop(_i3);
            }

            /* Check fee pool balances for regular ops */
            function checkPoolBalance(map) {
                if (!Object.keys(map).length) return [];
                var final_fees = [];

                var _loop2 = function _loop2(asset) {
                    var feePool = feePoolMap[asset] ? parseInt(feePoolMap[asset].fee_pool, 10) : 0;
                    /* Fee pool balance insufficient, default to core*/
                    if (map[asset].total > feePool) {
                        map[asset].ops.forEach(function (opIndex) {
                            if (coreFees[opIndex].length === 2 && "propIdx" in map[asset]) {
                                /* Proposal op */
                                map[asset].propIdx.forEach(function (prop_idx) {
                                    final_fees[prop_idx] = coreFees[opIndex][1][prop_idx];
                                });
                            } else if (coreFees[opIndex].length === 2) {
                                final_fees[opIndex] = coreFees[opIndex][0];
                            } else {
                                final_fees[opIndex] = coreFees[opIndex];
                            }
                        });
                        /* Use the desired fee asset */
                    } else {
                        map[asset].ops.forEach(function (opIndex) {
                            if (coreFees[opIndex].length === 2 && "propIdx" in map[asset]) {
                                map[asset].propIdx.forEach(function (prop_idx) {
                                    final_fees[prop_idx] = proposalFeesByAsset[asset][prop_idx];
                                });
                            } else {
                                final_fees[opIndex] = feesByAsset[asset][opIndex];
                            }
                        });
                    }
                };

                for (var asset in map) {
                    _loop2(asset);
                }
                return final_fees;
            }

            var finalFees = checkPoolBalance(feeMap);

            var finalProposalFees = {};
            for (var _key in proposalFeeMap) {
                finalProposalFees[_key] = checkPoolBalance(proposalFeeMap[_key]);
            }

            var set_fee = function set_fee(operation, opIndex) {
                if (!operation.fee || operation.fee.amount === 0 || operation.fee.amount.toString && operation.fee.amount.toString() === "0" // Long
                ) {
                        if (removeDuplicates) {
                            var _op = _serializer.ops.operation.toObject(_this3.operations[opIndex]);
                            var originalIndex = getDuplicateOriginalIndex(_op, opIndex);
                            if (originalIndex >= 0) {
                                // it's a duplicate
                                operation.fee = finalFees[originalIndex];
                            } else {
                                operation.fee = finalFees[opIndex];
                            }
                        } else {
                            operation.fee = finalFees[opIndex];
                        }
                    }
                if (operation.proposed_ops) {
                    var result = [];
                    /*
                    * Loop over proposed_ops and assign fee asset ids as
                    * determined by the fee pool balance check. If the balance
                    * is sufficient the asset_id is kept, if not it defaults to
                    * "1.3.0"
                    */
                    for (var y = 0; y < operation.proposed_ops.length; y++) {
                        operation.proposed_ops[y].op[1].fee.asset_id = finalProposalFees[opIndex][y].asset_id;
                    }

                    return result;
                }
            };
            /* We apply the final fees the the operations */
            for (var _i4 = 0; _i4 < _this3.operations.length; _i4++) {
                set_fee(_this3.operations[_i4][1], _i4);
            }
        });
        //DEBUG console.log('... get_required_fees',operations,asset_id,flat_fees)
    };

    TransactionBuilder.prototype.get_potential_signatures = function get_potential_signatures() {
        var tr_object = _serializer.ops.signed_transaction.toObject(this);
        return Promise.all([_bitsharesjsWs.Apis.instance().db_api().exec("get_potential_signatures", [tr_object]), _bitsharesjsWs.Apis.instance().db_api().exec("get_potential_address_signatures", [tr_object])]).then(function (results) {
            return { pubkeys: results[0], addys: results[1] };
        });
    };

    TransactionBuilder.prototype.get_required_signatures = function get_required_signatures(available_keys) {
        if (!available_keys.length) {
            return Promise.resolve([]);
        }
        var tr_object = _serializer.ops.signed_transaction.toObject(this);
        //DEBUG console.log('... tr_object',tr_object)
        return _bitsharesjsWs.Apis.instance().db_api().exec("get_required_signatures", [tr_object, available_keys]).then(function (required_public_keys) {
            //DEBUG console.log('... get_required_signatures',required_public_keys)
            return required_public_keys;
        });
    };

    TransactionBuilder.prototype.add_signer = function add_signer(private_key) {
        var public_key = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : private_key.toPublicKey();

        (0, _assert2.default)(private_key.d, "required PrivateKey object");

        if (this.signed) {
            throw new Error("already signed");
        }
        if (!public_key.Q) {
            public_key = _ecc.PublicKey.fromPublicKeyString(public_key);
        }
        // prevent duplicates
        var spHex = private_key.toHex();
        for (var _iterator3 = this.signer_private_keys, _isArray3 = Array.isArray(_iterator3), _i5 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
            var _ref4;

            if (_isArray3) {
                if (_i5 >= _iterator3.length) break;
                _ref4 = _iterator3[_i5++];
            } else {
                _i5 = _iterator3.next();
                if (_i5.done) break;
                _ref4 = _i5.value;
            }

            var sp = _ref4;

            if (sp[0].toHex() === spHex) return;
        }
        this.signer_private_keys.push([private_key, public_key]);
    };

    TransactionBuilder.prototype.sign = function sign() {
        var chain_id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _bitsharesjsWs.Apis.instance().chain_id;

        if (!this.tr_buffer) {
            throw new Error("not finalized");
        }
        if (this.signed) {
            throw new Error("already signed");
        }
        if (!this.signer_private_keys.length) {
            throw new Error("Transaction was not signed. Do you have a private key? [no_signers]");
        }
        var end = this.signer_private_keys.length;
        for (var i = 0; 0 < end ? i < end : i > end; 0 < end ? i++ : i++) {
            var _signer_private_keys$ = this.signer_private_keys[i],
                private_key = _signer_private_keys$[0],
                public_key = _signer_private_keys$[1];

            var sig = _ecc.Signature.signBuffer(Buffer.concat([new Buffer(chain_id, "hex"), this.tr_buffer]), private_key, public_key);
            this.signatures.push(sig.toBuffer());
        }
        this.signer_private_keys = [];
        this.signed = true;
        return;
    };

    TransactionBuilder.prototype.serialize = function serialize() {
        return _serializer.ops.signed_transaction.toObject(this);
    };

    TransactionBuilder.prototype.toObject = function toObject() {
        return _serializer.ops.signed_transaction.toObject(this);
    };

    TransactionBuilder.prototype.broadcast = function broadcast(was_broadcast_callback) {
        var _this4 = this;

        if (this.tr_buffer) {
            return this._broadcast(was_broadcast_callback);
        } else {
            return this.finalize().then(function () {
                return _this4._broadcast(was_broadcast_callback);
            });
        }
    };

    return TransactionBuilder;
}();

var base_expiration_sec = function base_expiration_sec() {
    var head_block_sec = Math.ceil(getHeadBlockDate().getTime() / 1000);
    var now_sec = Math.ceil(Date.now() / 1000);
    // The head block time should be updated every 3 seconds.  If it isn't
    // then help the transaction to expire (use head_block_sec)
    if (now_sec - head_block_sec > 30) {
        return head_block_sec;
    }
    // If the user's clock is very far behind, use the head block time.
    return Math.max(now_sec, head_block_sec);
};

function _broadcast(was_broadcast_callback) {
    var _this5 = this;

    return new Promise(function (resolve, reject) {
        if (!_this5.signed) {
            _this5.sign();
        }
        if (!_this5.tr_buffer) {
            throw new Error("not finalized");
        }
        if (!_this5.signatures.length) {
            throw new Error("not signed");
        }
        if (!_this5.operations.length) {
            throw new Error("no operations");
        }

        var tr_object = _serializer.ops.signed_transaction.toObject(_this5);
        // console.log('... broadcast_transaction_with_callback !!!')
        _bitsharesjsWs.Apis.instance().network_api().exec("broadcast_transaction_with_callback", [function (res) {
            return resolve(res);
        }, tr_object]).then(function () {
            //console.log('... broadcast success, waiting for callback')
            if (was_broadcast_callback) was_broadcast_callback();
            return;
        }).catch(function (error) {
            // console.log may be redundant for network errors, other errors could occur
            console.log(error);
            var message = error.message;
            if (!message) {
                message = "";
            }
            reject(new Error(message + "\n" + "bitshares-crypto " + " digest " + _ecc.hash.sha256(_this5.tr_buffer).toString("hex") + " transaction " + _this5.tr_buffer.toString("hex") + " " + JSON.stringify(tr_object)));
            return;
        });
        return;
    });
}

function getHeadBlockDate() {
    return timeStringToDate(head_block_time_string);
}

function timeStringToDate(time_string) {
    if (!time_string) return new Date("1970-01-01T00:00:00.000Z");
    if (!/Z$/.test(time_string))
        //does not end in Z
        // https://github.com/cryptonomex/graphene/issues/368
        time_string = time_string + "Z";
    return new Date(time_string);
}

exports.default = TransactionBuilder;
module.exports = exports["default"];