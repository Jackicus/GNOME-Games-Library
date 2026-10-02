// Off in the shipped extension; scripts/dev-extension.js turns it on.

let verbose = false;

export function setVerbose(on) {
    verbose = on;
}

export function note(message) {
    if (verbose)
        console.log(`[Games Library] ${message}`);
}
