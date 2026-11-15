#!/usr/bin/env node
"use strict";

// Prevent Electron's ASAR fs wrapper from intercepting .asar file I/O when run via ELECTRON_RUN_AS_NODE=1
process.noAsar = true;

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const vm = require("vm");

const BLOCK_SIZE = 4 * 1024 * 1024; // 4 MiB Electron ASAR integrity block size
const PATCH_START = "// [AGY-CUSTOM-THEME-START]";
const PATCH_END = "// [AGY-CUSTOM-THEME-END]";

function getDefaultAsarPath() {
    const localAppData =
        process.env.LOCALAPPDATA ||
        path.join(process.env.USERPROFILE || os.homedir(), "AppData", "Local");
    return path.join(localAppData, "Programs", "antigravity", "resources", "app.asar");
}

function sha256Buffer(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function computeIntegrity(dataBuf) {
    const fullHash = sha256Buffer(dataBuf);
    const blocks = [];
    if (dataBuf.length === 0) {
        blocks.push(fullHash);
    }
    else {
        for (let off = 0; off < dataBuf.length; off += BLOCK_SIZE) {
            const chunk = dataBuf.subarray(off, Math.min(off + BLOCK_SIZE, dataBuf.length));
            blocks.push(sha256Buffer(chunk));
        }
    }
    return {
        algorithm: "SHA256",
        hash: fullHash,
        blockSize: BLOCK_SIZE,
        blocks,
    };
}

function parseAsarBuffer(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 16) {
        throw new Error("Invalid ASAR: buffer smaller than 16 bytes");
    }
    const u0 = buf.readUInt32LE(0);
    const headerSize = buf.readUInt32LE(4);
    const payloadSize = buf.readUInt32LE(8);
    const jsonByteLen = buf.readUInt32LE(12);

    if (u0 !== 4) {
        throw new Error(`Invalid ASAR pickle: expected u0=4, got ${u0}`);
    }
    if (headerSize !== 4 + payloadSize) {
        throw new Error(`Invalid ASAR pickle: headerSize=${headerSize}, payloadSize=${payloadSize}`);
    }
    if (payloadSize < 4 + jsonByteLen || (payloadSize - 4) % 4 !== 0) {
        throw new Error(`Invalid ASAR alignment: payloadSize=${payloadSize}, jsonByteLen=${jsonByteLen}`);
    }
    const dataOffset = 8 + headerSize;
    if (dataOffset > buf.length) {
        throw new Error(`Invalid ASAR: dataOffset ${dataOffset} exceeds file length ${buf.length}`);
    }

    const headerStr = buf.subarray(16, 16 + jsonByteLen).toString("utf8");
    const header = JSON.parse(headerStr);
    if (!header || typeof header !== "object" || !header.files) {
        throw new Error("Invalid ASAR header JSON: missing root files object");
    }

    const fileBuffers = new Map();
    const packedRanges = [];

    function walk(node, relPath) {
        if (!node || typeof node !== "object") {
            throw new Error(`Invalid ASAR entry at ${relPath}`);
        }
        if (node.files) {
            for (const [name, child] of Object.entries(node.files)) {
                walk(child, relPath ? `${relPath}/${name}` : name);
            }
            return;
        }
        if (node.link !== undefined) {
            return;
        }
        if (node.unpacked) {
            return;
        }
        if (typeof node.size !== "number" || !Number.isInteger(node.size) || node.size < 0) {
            throw new Error(`Invalid ASAR entry size for ${relPath}: ${String(node.size)}`);
        }
        if (typeof node.offset !== "string" || !/^\d+$/.test(node.offset)) {
            throw new Error(`Invalid ASAR offset string for ${relPath}: ${String(node.offset)}`);
        }
        const offsetNum = Number(node.offset);
        const start = dataOffset + offsetNum;
        const end = start + node.size;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end > buf.length) {
            throw new Error(`ASAR entry ${relPath} out of bounds (${start}..${end} vs ${buf.length})`);
        }
        const slice = Buffer.from(buf.subarray(start, end));
        fileBuffers.set(relPath, slice);
        packedRanges.push({ relPath, offsetNum, size: node.size, integrity: node.integrity });
    }

    walk(header, "");
    return { header, headerSize, payloadSize, jsonByteLen, dataOffset, fileBuffers, packedRanges };
}

function verifyAsarBuffer(buf) {
    const parsed = parseAsarBuffer(buf);
    const sorted = [...parsed.packedRanges].sort((a, b) => a.offsetNum - b.offsetNum);
    let cursor = 0;
    for (const item of sorted) {
        if (item.offsetNum !== cursor) {
            throw new Error(
                `ASAR offset mismatch for ${item.relPath}: expected ${cursor}, got ${item.offsetNum}`
            );
        }
        cursor += item.size;
        const data = parsed.fileBuffers.get(item.relPath);
        if (item.integrity) {
            const expected = computeIntegrity(data);
            if (
                item.integrity.algorithm !== "SHA256" ||
                item.integrity.hash !== expected.hash ||
                !Array.isArray(item.integrity.blocks) ||
                item.integrity.blocks.length !== expected.blocks.length ||
                item.integrity.blocks.some((b, idx) => b !== expected.blocks[idx])
            ) {
                throw new Error(`ASAR integrity mismatch for ${item.relPath}`);
            }
        }
    }
    if (parsed.dataOffset + cursor !== buf.length) {
        throw new Error(
            `ASAR total size mismatch: expected ${parsed.dataOffset + cursor}, actual ${buf.length}`
        );
    }
    return parsed;
}

function buildAsarBuffer(headerTree, fileBuffers) {
    const cloned = JSON.parse(JSON.stringify(headerTree));
    const dataChunks = [];
    let cursor = 0;

    function rebuild(node, relPath) {
        if (node.files) {
            for (const [name, child] of Object.entries(node.files)) {
                rebuild(child, relPath ? `${relPath}/${name}` : name);
            }
            return;
        }
        if (node.link !== undefined || node.unpacked) {
            return;
        }
        const dataBuf = fileBuffers.get(relPath);
        if (!Buffer.isBuffer(dataBuf)) {
            throw new Error(`Missing buffer for packed ASAR entry: ${relPath}`);
        }
        const rebuilt = {
            size: dataBuf.length,
            offset: String(cursor),
            integrity: computeIntegrity(dataBuf),
        };
        if (node.executable) {
            rebuilt.executable = true;
        }
        const parts = relPath.split("/");
        const fileName = parts.pop();
        let parent = cloned;
        for (const dir of parts) {
            parent = parent.files[dir];
        }
        parent.files[fileName] = rebuilt;
        dataChunks.push(dataBuf);
        cursor += dataBuf.length;
    }

    rebuild(cloned, "");

    const jsonBuf = Buffer.from(JSON.stringify(cloned), "utf8");
    const pad = (4 - (jsonBuf.length % 4)) % 4;
    const payloadSize = 4 + jsonBuf.length + pad;
    const headerSize = 4 + payloadSize;

    const headerBuf = Buffer.alloc(8 + headerSize, 0);
    headerBuf.writeUInt32LE(4, 0);
    headerBuf.writeUInt32LE(headerSize, 4);
    headerBuf.writeUInt32LE(payloadSize, 8);
    headerBuf.writeUInt32LE(jsonBuf.length, 12);
    jsonBuf.copy(headerBuf, 16);

    const result = Buffer.concat([headerBuf, ...dataChunks]);
    verifyAsarBuffer(result);
    return result;
}

function setEntryInTree(headerTree, fileBuffers, relPath, contentBuf) {
    const parts = relPath.split("/");
    const fileName = parts.pop();
    let cur = headerTree;
    for (const dir of parts) {
        if (!cur.files) {
            cur.files = {};
        }
        if (!cur.files[dir]) {
            cur.files[dir] = { files: {} };
        }
        cur = cur.files[dir];
    }
    if (!cur.files) {
        cur.files = {};
    }
    cur.files[fileName] = {
        size: contentBuf.length,
        offset: "0",
        integrity: computeIntegrity(contentBuf),
    };
    fileBuffers.set(relPath, contentBuf);
}

function getEntryText(fileBuffers, relPath) {
    const buf = fileBuffers.get(relPath);
    if (!buf) {
        throw new Error(`Required ASAR entry missing: ${relPath}`);
    }
    return buf.toString("utf8");
}

function hasPatchMarkers(text) {
    return text.includes(PATCH_START) && text.includes(PATCH_END);
}

function isAsarPatched(parsed) {
    if (parsed.fileBuffers.has("dist/customThemeMain.js") || parsed.fileBuffers.has("dist/customThemePreload.js")) {
        return true;
    }
    for (const rel of ["dist/main.js", "dist/preload.js", "dist/customScheme.js"]) {
        const buf = parsed.fileBuffers.get(rel);
        if (buf && hasPatchMarkers(buf.toString("utf8"))) {
            return true;
        }
    }
    return false;
}

function patchCustomSchemeJs(raw) {
    if (hasPatchMarkers(raw)) {
        return raw;
    }
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";

    const schemeAnchorRe = /(scheme:\s*faviconStore_1\.FAVICON_SCHEME,\s*\r?\n\s*privileges:\s*\{\s*standard:\s*true,\s*secure:\s*true\s*\},\s*\r?\n\s*\},)/;
    if (!schemeAnchorRe.test(raw)) {
        throw new Error("Could not locate FAVICON_SCHEME registration anchor in dist/customScheme.js");
    }
    let patched = raw.replace(
        schemeAnchorRe,
        `$1${eol}` +
        `        ${PATCH_START}${eol}` +
        `        {${eol}` +
        `            scheme: 'agy-theme',${eol}` +
        `            privileges: { standard: true, secure: true },${eol}` +
        `        },${eol}` +
        `        ${PATCH_END}`
    );

    const handlerAnchorRe = /(electron_1\.protocol\.handle\(faviconStore_1\.FAVICON_SCHEME,\s*handleFaviconProtocolRequest\);)/;
    if (!handlerAnchorRe.test(patched)) {
        throw new Error("Could not locate FAVICON_SCHEME protocol.handle anchor in dist/customScheme.js");
    }
    patched = patched.replace(
        handlerAnchorRe,
        `$1${eol}` +
        `    ${PATCH_START}${eol}` +
        `    electron_1.protocol.handle('agy-theme', require('./customThemeMain').handleThemeProtocolRequest);${eol}` +
        `    ${PATCH_END}`
    );
    return patched;
}

function patchMainJs(raw) {
    if (hasPatchMarkers(raw)) {
        return raw;
    }
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const anchorRe = /(\(0,\s*customScheme_1\.registerCustomSchemeHandlers\)\(\);)/;
    if (!anchorRe.test(raw)) {
        throw new Error("Could not locate registerCustomSchemeHandlers() anchor in dist/main.js");
    }
    return raw.replace(
        anchorRe,
        `$1${eol}` +
        `    ${PATCH_START}${eol}` +
        `    try {${eol}` +
        `        require('./customThemeMain').initCustomThemeMain();${eol}` +
        `    }${eol}` +
        `    catch (err) {${eol}` +
        `        console.error('[custom-theme] Init failed:', err);${eol}` +
        `    }${eol}` +
        `    ${PATCH_END}`
    );
}

function patchPreloadJs(raw, customPreloadSource) {
    if (hasPatchMarkers(raw)) {
        return raw;
    }
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const anchorRe = /(if\s*\(\s*!isRemoteWindow\s*\)\s*\{\s*\r?\n\s*installHubSurfaceThemeAutoSync\(\);\s*\r?\n\s*installCustomFlagOverridesSync\(\);)/;
    if (!anchorRe.test(raw)) {
        throw new Error("Could not locate !isRemoteWindow hook anchor in dist/preload.js");
    }
    // Inline customThemePreload.js directly because Electron >= 20 defaults to
    // sandboxed preload scripts where relative require('./...') is disallowed.
    const normalizedPreload = String(customPreloadSource || "")
        .replace(/^\s*"use strict";\s*\r?\n?/, "")
        .replace(/\r?\n/g, eol);
    return raw.replace(
        anchorRe,
        (match) =>
            `${match}${eol}` +
            `    ${PATCH_START}${eol}` +
            `    try {${eol}` +
            `${normalizedPreload}${eol}` +
            `    }${eol}` +
            `    catch (err) {${eol}` +
            `        console.error('[custom-theme] Preload failed:', err);${eol}` +
            `    }${eol}` +
            `    ${PATCH_END}`
    );
}

function syntaxCheckJs(code, filename) {
    new vm.Script(code, { filename });
}

function writeAtomic(targetPath, buf) {
    const dir = path.dirname(targetPath);
    const tmpPath = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
    try {
        fs.writeFileSync(tmpPath, buf);
        fs.renameSync(tmpPath, targetPath);
    }
    catch (err) {
        try {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        }
        catch {
            // Ignore cleanup error.
        }
        if (err && (err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES")) {
            throw new Error(
                `Cannot write ${targetPath} (${err.code}). Please close Antigravity completely (including system tray) and retry.`
            );
        }
        throw err;
    }
}

function parseSha256File(shaPath) {
    const raw = fs.readFileSync(shaPath, "utf8").trim();
    const match = /^([a-fA-F0-9]{64})\b/.exec(raw);
    return match ? match[1].toLowerCase() : null;
}

function writeSha256File(shaPath, hashHex, targetFilename) {
    writeAtomic(shaPath, Buffer.from(`${hashHex}  ${targetFilename}\n`, "utf8"));
}

function cmdInstall(asarPath, projectDir) {
    if (!fs.existsSync(asarPath)) {
        throw new Error(`Target app.asar not found: ${asarPath}`);
    }
    const srcMainPath = path.join(projectDir, "src", "customThemeMain.js");
    const srcPreloadPath = path.join(projectDir, "src", "customThemePreload.js");
    if (!fs.existsSync(srcMainPath) || !fs.existsSync(srcPreloadPath)) {
        throw new Error(`Missing source files in ${path.join(projectDir, "src")}`);
    }
    const customMainBuf = fs.readFileSync(srcMainPath);
    const customPreloadBuf = fs.readFileSync(srcPreloadPath);
    syntaxCheckJs(customMainBuf.toString("utf8"), "dist/customThemeMain.js");
    syntaxCheckJs(customPreloadBuf.toString("utf8"), "dist/customThemePreload.js");

    const bakPath = `${asarPath}.orig.bak`;
    const shaPath = `${asarPath}.orig.sha256`;

    const currentBuf = fs.readFileSync(asarPath);
    const currentParsed = verifyAsarBuffer(currentBuf);
    const currentPatched = isAsarPatched(currentParsed);
    const currentSha = sha256Buffer(currentBuf);

    if (!fs.existsSync(bakPath)) {
        if (currentPatched) {
            throw new Error(
                `Target ${asarPath} is already patched, but ${bakPath} does not exist. Refusing to create a backup from a patched ASAR.`
            );
        }
        writeAtomic(bakPath, currentBuf);
        writeSha256File(shaPath, currentSha, path.basename(asarPath));
        console.log(`[backup] Created ${bakPath} (SHA256: ${currentSha})`);
    }
    else {
        const bakBuf = fs.readFileSync(bakPath);
        const bakParsed = verifyAsarBuffer(bakBuf);
        if (isAsarPatched(bakParsed)) {
            throw new Error(`Backup file ${bakPath} appears patched/corrupted.`);
        }
        const bakSha = sha256Buffer(bakBuf);
        if (fs.existsSync(shaPath)) {
            const expectedSha = parseSha256File(shaPath);
            if (expectedSha && expectedSha !== bakSha) {
                throw new Error(
                    `Backup hash mismatch for ${bakPath}: expected ${expectedSha}, got ${bakSha}`
                );
            }
        }
        else {
            writeSha256File(shaPath, bakSha, path.basename(asarPath));
        }

        if (!currentPatched && currentSha !== bakSha) {
            const prevBak = `${asarPath}.prev.orig.bak`;
            writeAtomic(prevBak, bakBuf);
            writeAtomic(bakPath, currentBuf);
            writeSha256File(shaPath, currentSha, path.basename(asarPath));
            console.log(
                `[backup] Detected updated upstream app.asar; archived previous backup to ${prevBak} and refreshed ${bakPath} (SHA256: ${currentSha})`
            );
        }
        else {
            console.log(`[backup] Preserved existing original backup ${bakPath} (SHA256: ${bakSha})`);
        }
    }

    const baseBuf = fs.readFileSync(bakPath);
    const baseParsed = verifyAsarBuffer(baseBuf);

    const customSchemePatched = patchCustomSchemeJs(getEntryText(baseParsed.fileBuffers, "dist/customScheme.js"));
    const mainPatched = patchMainJs(getEntryText(baseParsed.fileBuffers, "dist/main.js"));
    const preloadPatched = patchPreloadJs(
        getEntryText(baseParsed.fileBuffers, "dist/preload.js"),
        customPreloadBuf.toString("utf8")
    );

    syntaxCheckJs(customSchemePatched, "dist/customScheme.js");
    syntaxCheckJs(mainPatched, "dist/main.js");
    syntaxCheckJs(preloadPatched, "dist/preload.js");

    setEntryInTree(baseParsed.header, baseParsed.fileBuffers, "dist/customScheme.js", Buffer.from(customSchemePatched, "utf8"));
    setEntryInTree(baseParsed.header, baseParsed.fileBuffers, "dist/main.js", Buffer.from(mainPatched, "utf8"));
    setEntryInTree(baseParsed.header, baseParsed.fileBuffers, "dist/preload.js", Buffer.from(preloadPatched, "utf8"));
    setEntryInTree(baseParsed.header, baseParsed.fileBuffers, "dist/customThemeMain.js", customMainBuf);
    setEntryInTree(baseParsed.header, baseParsed.fileBuffers, "dist/customThemePreload.js", customPreloadBuf);

    const outBuf = buildAsarBuffer(baseParsed.header, baseParsed.fileBuffers);
    writeAtomic(asarPath, outBuf);
    const outSha = sha256Buffer(fs.readFileSync(asarPath));
    console.log(`[install] Patched ${asarPath} (${outBuf.length} bytes, SHA256: ${outSha})`);
}

function cmdUninstall(asarPath) {
    const bakPath = `${asarPath}.orig.bak`;
    const shaPath = `${asarPath}.orig.sha256`;

    if (!fs.existsSync(bakPath)) {
        throw new Error(`Backup file not found: ${bakPath}`);
    }
    const bakBuf = fs.readFileSync(bakPath);
    verifyAsarBuffer(bakBuf);
    const bakSha = sha256Buffer(bakBuf);

    if (fs.existsSync(shaPath)) {
        const expectedSha = parseSha256File(shaPath);
        if (!expectedSha || expectedSha !== bakSha) {
            throw new Error(
                `Backup SHA256 verification failed! Expected ${expectedSha}, got ${bakSha}`
            );
        }
    }

    writeAtomic(asarPath, bakBuf);
    const restoredBuf = fs.readFileSync(asarPath);
    const restoredSha = sha256Buffer(restoredBuf);
    if (restoredSha !== bakSha) {
        throw new Error(
            `Restored app.asar SHA256 mismatch! Expected ${bakSha}, got ${restoredSha}`
        );
    }
    console.log(`[uninstall] Restored original ${asarPath} byte-for-byte (SHA256: ${restoredSha})`);
}

function cmdStatus(asarPath) {
    const bakPath = `${asarPath}.orig.bak`;
    const shaPath = `${asarPath}.orig.sha256`;
    if (!fs.existsSync(asarPath)) {
        throw new Error(`ASAR not found: ${asarPath}`);
    }
    const buf = fs.readFileSync(asarPath);
    const parsed = verifyAsarBuffer(buf);
    const patched = isAsarPatched(parsed);
    const sha = sha256Buffer(buf);
    const bakExists = fs.existsSync(bakPath);
    const bakSha = bakExists ? sha256Buffer(fs.readFileSync(bakPath)) : null;
    const recordedSha = fs.existsSync(shaPath) ? parseSha256File(shaPath) : null;
    console.log(
        JSON.stringify(
            {
                asarPath,
                size: buf.length,
                sha256: sha,
                patched,
                hasCustomThemeMain: parsed.fileBuffers.has("dist/customThemeMain.js"),
                hasCustomThemePreload: parsed.fileBuffers.has("dist/customThemePreload.js"),
                backupExists: bakExists,
                backupSha256: bakSha,
                recordedOrigSha256: recordedSha,
                packedEntries: parsed.packedRanges.length,
            },
            null,
            2
        )
    );
}

function parseArgs(argv) {
    const args = argv.slice(2);
    const command = args[0];
    let asarPath = process.env.AGY_ASAR_PATH || getDefaultAsarPath();
    let projectDir = path.resolve(__dirname, "..");

    for (let i = 1; i < args.length; i++) {
        const a = args[i];
        if (a === "--asar" && i + 1 < args.length) {
            asarPath = path.resolve(args[++i]);
        }
        else if (a === "--project" && i + 1 < args.length) {
            projectDir = path.resolve(args[++i]);
        }
        else {
            throw new Error(`Unknown or incomplete argument: ${a}`);
        }
    }
    return { command, asarPath, projectDir };
}

function main() {
    const { command, asarPath, projectDir } = parseArgs(process.argv);
    switch (command) {
        case "install":
            cmdInstall(asarPath, projectDir);
            break;
        case "uninstall":
            cmdUninstall(asarPath);
            break;
        case "status":
        case "verify":
            cmdStatus(asarPath);
            break;
        default:
            console.error(
                "Usage: node patch-asar.js <install|uninstall|status|verify> [--asar <path>] [--project <dir>]"
            );
            process.exit(1);
    }
}

main();
