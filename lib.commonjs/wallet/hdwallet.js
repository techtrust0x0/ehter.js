"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountPath = exports.HDNodeWalletManager = exports.HDNodeVoidWallet = exports.HDNodeWallet = exports.defaultPath = void 0;
/**
 *  Explain HD Wallets..
 *
 *  @_subsection: api/wallet:HD Wallets  [hd-wallets]
 */
const index_js_1 = require("../crypto/index.js");
const index_js_2 = require("../providers/index.js");
const index_js_3 = require("../transaction/index.js");
const index_js_4 = require("../utils/index.js");
const lang_en_js_1 = require("../wordlists/lang-en.js");
const base_wallet_js_1 = require("./base-wallet.js");
const mnemonic_js_1 = require("./mnemonic.js");
const json_keystore_js_1 = require("./json-keystore.js");
exports.defaultPath = "m/44'/60'/0'/0/0";
// "Bitcoin seed"
const MasterSecret = new Uint8Array([66, 105, 116, 99, 111, 105, 110, 32, 115, 101, 101, 100]);
const HardenedBit = 0x80000000;
const N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
const Nibbles = "0123456789abcdef";
function zpad(value, length) {
    let result = "";
    while (value) {
        result = Nibbles[value % 16] + result;
        value = Math.trunc(value / 16);
    }
    while (result.length < length * 2) {
        result = "0" + result;
    }
    return "0x" + result;
}
function encodeBase58Check(_value) {
    const value = (0, index_js_4.getBytes)(_value);
    const check = (0, index_js_4.dataSlice)((0, index_js_1.sha256)((0, index_js_1.sha256)(value)), 0, 4);
    const bytes = (0, index_js_4.concat)([value, check]);
    return (0, index_js_4.encodeBase58)(bytes);
}
const _guard = {};
function ser_I(index, chainCode, publicKey, privateKey) {
    const data = new Uint8Array(37);
    if (index & HardenedBit) {
        (0, index_js_4.assert)(privateKey != null, "cannot derive child of neutered node", "UNSUPPORTED_OPERATION", {
            operation: "deriveChild"
        });
        // Data = 0x00 || ser_256(k_par)
        data.set((0, index_js_4.getBytes)(privateKey), 1);
    }
    else {
        // Data = ser_p(point(k_par))
        data.set((0, index_js_4.getBytes)(publicKey));
    }
    // Data += ser_32(i)
    for (let i = 24; i >= 0; i -= 8) {
        data[33 + (i >> 3)] = ((index >> (24 - i)) & 0xff);
    }
    const I = (0, index_js_4.getBytes)((0, index_js_1.computeHmac)("sha512", chainCode, data));
    return { IL: I.slice(0, 32), IR: I.slice(32) };
}
function derivePath(node, path) {
    const components = path.split("/");
    (0, index_js_4.assertArgument)(components.length > 0 && (components[0] === "m" || node.depth > 0), "invalid path", "path", path);
    if (components[0] === "m") {
        components.shift();
    }
    let result = node;
    for (let i = 0; i < components.length; i++) {
        const component = components[i];
        if (component.match(/^[0-9]+'$/)) {
            const index = parseInt(component.substring(0, component.length - 1));
            (0, index_js_4.assertArgument)(index < HardenedBit, "invalid path index", `path[${i}]`, component);
            result = result.deriveChild(HardenedBit + index);
        }
        else if (component.match(/^[0-9]+$/)) {
            const index = parseInt(component);
            (0, index_js_4.assertArgument)(index < HardenedBit, "invalid path index", `path[${i}]`, component);
            result = result.deriveChild(index);
        }
        else {
            (0, index_js_4.assertArgument)(false, "invalid path component", `path[${i}]`, component);
        }
    }
    return result;
}
class HDNodeWallet extends base_wallet_js_1.BaseWallet {
    publicKey;
    fingerprint;
    parentFingerprint;
    mnemonic;
    chainCode;
    path;
    index;
    depth;
    /**
     *  @private
     */
    constructor(guard, signingKey, parentFingerprint, chainCode, path, index, depth, mnemonic, provider) {
        super(signingKey, provider);
        (0, index_js_4.assertPrivate)(guard, _guard, "HDNodeWallet");
        (0, index_js_4.defineProperties)(this, { publicKey: signingKey.compressedPublicKey });
        const fingerprint = (0, index_js_4.dataSlice)((0, index_js_1.ripemd160)((0, index_js_1.sha256)(this.publicKey)), 0, 4);
        (0, index_js_4.defineProperties)(this, {
            parentFingerprint, fingerprint,
            chainCode, path, index, depth
        });
        (0, index_js_4.defineProperties)(this, { mnemonic });
    }
    connect(provider) {
        return new HDNodeWallet(_guard, this.signingKey, this.parentFingerprint, this.chainCode, this.path, this.index, this.depth, this.mnemonic, provider);
    }
    #account() {
        const account = { address: this.address, privateKey: this.privateKey };
        const m = this.mnemonic;
        if (this.path && m && m.wordlist.locale === "en" && m.password === "") {
            account.mnemonic = {
                path: this.path,
                locale: "en",
                entropy: m.entropy
            };
        }
        return account;
    }
    /**
     *  Resolves to a [JSON Keystore Wallet](json-wallets) encrypted with
     *  %%password%%.
     *
     *  If %%progressCallback%% is specified, it will receive periodic
     *  updates as the encryption process progreses.
     */
    async encrypt(password, progressCallback) {
        return await (0, json_keystore_js_1.encryptKeystoreJson)(this.#account(), password, { progressCallback });
    }
    /**
     *  Returns a [JSON Keystore Wallet](json-wallets) encryped with
     *  %%password%%.
     *
     *  It is preferred to use the [async version](encrypt) instead,
     *  which allows a [[ProgressCallback]] to keep the user informed.
     *
     *  This method will block the event loop (freezing all UI) until
     *  it is complete, which may be a non-trivial duration.
     */
    encryptSync(password) {
        return (0, json_keystore_js_1.encryptKeystoreJsonSync)(this.#account(), password);
    }
    get extendedKey() {
        // We only support the mainnet values for now, but if anyone needs
        // testnet values, let me know. I believe current sentiment is that
        // we should always use mainnet, and use BIP-44 to derive the network
        //   - Mainnet: public=0x0488B21E, private=0x0488ADE4
        //   - Testnet: public=0x043587CF, private=0x04358394
        (0, index_js_4.assert)(this.depth < 256, "Depth too deep", "UNSUPPORTED_OPERATION", { operation: "extendedKey" });
        return encodeBase58Check((0, index_js_4.concat)([
            "0x0488ADE4", zpad(this.depth, 1), this.parentFingerprint,
            zpad(this.index, 4), this.chainCode,
            (0, index_js_4.concat)(["0x00", this.privateKey])
        ]));
    }
    hasPath() { return (this.path != null); }
    neuter() {
        return new HDNodeVoidWallet(_guard, this.address, this.publicKey, this.parentFingerprint, this.chainCode, this.path, this.index, this.depth, this.provider);
    }
    deriveChild(_index) {
        const index = (0, index_js_4.getNumber)(_index, "index");
        (0, index_js_4.assertArgument)(index <= 0xffffffff, "invalid index", "index", index);
        // Base path
        let path = this.path;
        if (path) {
            path += "/" + (index & ~HardenedBit);
            if (index & HardenedBit) {
                path += "'";
            }
        }
        const { IR, IL } = ser_I(index, this.chainCode, this.publicKey, this.privateKey);
        const ki = new index_js_1.SigningKey((0, index_js_4.toHex)(((0, index_js_4.toBigInt)(IL) + BigInt(this.privateKey)) % N, 32));
        return new HDNodeWallet(_guard, ki, this.fingerprint, (0, index_js_4.hexlify)(IR), path, index, this.depth + 1, this.mnemonic, this.provider);
    }
    derivePath(path) {
        return derivePath(this, path);
    }
    static #fromSeed(_seed, mnemonic) {
        (0, index_js_4.assertArgument)((0, index_js_4.isBytesLike)(_seed), "invalid seed", "seed", "[REDACTED]");
        const seed = (0, index_js_4.getBytes)(_seed, "seed");
        (0, index_js_4.assertArgument)(seed.length >= 16 && seed.length <= 64, "invalid seed", "seed", "[REDACTED]");
        const I = (0, index_js_4.getBytes)((0, index_js_1.computeHmac)("sha512", MasterSecret, seed));
        const signingKey = new index_js_1.SigningKey((0, index_js_4.hexlify)(I.slice(0, 32)));
        return new HDNodeWallet(_guard, signingKey, "0x00000000", (0, index_js_4.hexlify)(I.slice(32)), "m", 0, 0, mnemonic, null);
    }
    static fromExtendedKey(extendedKey) {
        const bytes = (0, index_js_4.toArray)((0, index_js_4.decodeBase58)(extendedKey)); // @TODO: redact
        (0, index_js_4.assertArgument)(bytes.length === 82 || encodeBase58Check(bytes.slice(0, 78)) === extendedKey, "invalid extended key", "extendedKey", "[ REDACTED ]");
        const depth = bytes[4];
        const parentFingerprint = (0, index_js_4.hexlify)(bytes.slice(5, 9));
        const index = parseInt((0, index_js_4.hexlify)(bytes.slice(9, 13)).substring(2), 16);
        const chainCode = (0, index_js_4.hexlify)(bytes.slice(13, 45));
        const key = bytes.slice(45, 78);
        switch ((0, index_js_4.hexlify)(bytes.slice(0, 4))) {
            // Public Key
            case "0x0488b21e":
            case "0x043587cf": {
                const publicKey = (0, index_js_4.hexlify)(key);
                return new HDNodeVoidWallet(_guard, (0, index_js_3.computeAddress)(publicKey), publicKey, parentFingerprint, chainCode, null, index, depth, null);
            }
            // Private Key
            case "0x0488ade4":
            case "0x04358394 ":
                if (key[0] !== 0) {
                    break;
                }
                return new HDNodeWallet(_guard, new index_js_1.SigningKey(key.slice(1)), parentFingerprint, chainCode, null, index, depth, null, null);
        }
        (0, index_js_4.assertArgument)(false, "invalid extended key prefix", "extendedKey", "[ REDACTED ]");
    }
    static createRandom(password, path, wordlist) {
        if (password == null) {
            password = "";
        }
        if (path == null) {
            path = exports.defaultPath;
        }
        if (wordlist == null) {
            wordlist = lang_en_js_1.LangEn.wordlist();
        }
        const mnemonic = mnemonic_js_1.Mnemonic.fromEntropy((0, index_js_1.randomBytes)(16), password, wordlist);
        return HDNodeWallet.#fromSeed(mnemonic.computeSeed(), mnemonic).derivePath(path);
    }
    static fromMnemonic(mnemonic, path) {
        if (!path) {
            path = exports.defaultPath;
        }
        return HDNodeWallet.#fromSeed(mnemonic.computeSeed(), mnemonic).derivePath(path);
    }
    static fromPhrase(phrase, password, path, wordlist) {
        if (password == null) {
            password = "";
        }
        if (path == null) {
            path = exports.defaultPath;
        }
        if (wordlist == null) {
            wordlist = lang_en_js_1.LangEn.wordlist();
        }
        const mnemonic = mnemonic_js_1.Mnemonic.fromPhrase(phrase, password, wordlist);
        return HDNodeWallet.#fromSeed(mnemonic.computeSeed(), mnemonic).derivePath(path);
    }
    static fromSeed(seed) {
        return HDNodeWallet.#fromSeed(seed, null);
    }
}
exports.HDNodeWallet = HDNodeWallet;
class HDNodeVoidWallet extends index_js_2.VoidSigner {
    publicKey;
    fingerprint;
    parentFingerprint;
    chainCode;
    path;
    index;
    depth;
    /**
     *  @private
     */
    constructor(guard, address, publicKey, parentFingerprint, chainCode, path, index, depth, provider) {
        super(address, provider);
        (0, index_js_4.assertPrivate)(guard, _guard, "HDNodeVoidWallet");
        (0, index_js_4.defineProperties)(this, { publicKey });
        const fingerprint = (0, index_js_4.dataSlice)((0, index_js_1.ripemd160)((0, index_js_1.sha256)(publicKey)), 0, 4);
        (0, index_js_4.defineProperties)(this, {
            publicKey, fingerprint, parentFingerprint, chainCode, path, index, depth
        });
    }
    connect(provider) {
        return new HDNodeVoidWallet(_guard, this.address, this.publicKey, this.parentFingerprint, this.chainCode, this.path, this.index, this.depth, provider);
    }
    get extendedKey() {
        // We only support the mainnet values for now, but if anyone needs
        // testnet values, let me know. I believe current sentiment is that
        // we should always use mainnet, and use BIP-44 to derive the network
        //   - Mainnet: public=0x0488B21E, private=0x0488ADE4
        //   - Testnet: public=0x043587CF, private=0x04358394
        (0, index_js_4.assert)(this.depth < 256, "Depth too deep", "UNSUPPORTED_OPERATION", { operation: "extendedKey" });
        return encodeBase58Check((0, index_js_4.concat)([
            "0x0488B21E",
            zpad(this.depth, 1),
            this.parentFingerprint,
            zpad(this.index, 4),
            this.chainCode,
            this.publicKey,
        ]));
    }
    hasPath() { return (this.path != null); }
    deriveChild(_index) {
        const index = (0, index_js_4.getNumber)(_index, "index");
        (0, index_js_4.assertArgument)(index <= 0xffffffff, "invalid index", "index", index);
        // Base path
        let path = this.path;
        if (path) {
            path += "/" + (index & ~HardenedBit);
            if (index & HardenedBit) {
                path += "'";
            }
        }
        const { IR, IL } = ser_I(index, this.chainCode, this.publicKey, null);
        const Ki = index_js_1.SigningKey._addPoints(IL, this.publicKey, true);
        const address = (0, index_js_3.computeAddress)(Ki);
        return new HDNodeVoidWallet(_guard, address, Ki, this.fingerprint, (0, index_js_4.hexlify)(IR), path, index, this.depth + 1, this.provider);
    }
    derivePath(path) {
        return derivePath(this, path);
    }
}
exports.HDNodeVoidWallet = HDNodeVoidWallet;
class HDNodeWalletManager {
    #root;
    constructor(phrase, password, path, locale) {
        if (password == null) {
            password = "";
        }
        if (path == null) {
            path = "m/44'/60'/0'/0";
        }
        if (locale == null) {
            locale = lang_en_js_1.LangEn.wordlist();
        }
        this.#root = HDNodeWallet.fromPhrase(phrase, password, path, locale);
    }
    getSigner(index) {
        return this.#root.deriveChild((index == null) ? 0 : index);
    }
}
exports.HDNodeWalletManager = HDNodeWalletManager;
function getAccountPath(_index) {
    const index = (0, index_js_4.getNumber)(_index, "index");
    (0, index_js_4.assertArgument)(index >= 0 && index < HardenedBit, "invalid account index", "index", index);
    return `m/44'/60'/${index}'/0/0`;
}
exports.getAccountPath = getAccountPath;
//# sourceMappingURL=hdwallet.js.map