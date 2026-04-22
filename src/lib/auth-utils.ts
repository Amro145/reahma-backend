const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const ALGORITHM = "PBKDF2";
const HASH_ALGORITHM = "SHA-256";

export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: ALGORITHM },
        false,
        ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: ALGORITHM,
            salt,
            iterations: ITERATIONS,
            hash: HASH_ALGORITHM,
        },
        keyMaterial,
        KEY_LENGTH * 8
    );
    
    const hash = new Uint8Array(derivedBits);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
    const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
    
    return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const [saltHex, hashHex] = storedHash.split(":");
    
    if (!saltHex || !hashHex) {
        return false;
    }
    
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const originalHash = new Uint8Array(hashHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: ALGORITHM },
        false,
        ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: ALGORITHM,
            salt,
            iterations: ITERATIONS,
            hash: HASH_ALGORITHM,
        },
        keyMaterial,
        KEY_LENGTH * 8
    );
    
    const derivedHash = new Uint8Array(derivedBits);
    
    if (derivedHash.length !== originalHash.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < derivedHash.length; i++) {
        result |= derivedHash[i] ^ originalHash[i];
    }
    
    return result === 0;
}