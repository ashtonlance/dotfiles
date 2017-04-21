// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const crypto = require("crypto");
class Hash {
    /**
     * Creates a hash code from a string.
     */
    static hashCode(s) {
        return crypto
            .createHash("md5")
            .update(s)
            .digest("hex");
    }
}
exports.Hash = Hash;

//# sourceMappingURL=hash.js.map
