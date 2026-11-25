#include "Sha256.h"

#include <string.h>

namespace gctally {

namespace {

const uint32_t roundConstants[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
};

uint32_t rotateRight(uint32_t value, unsigned bits) { return (value >> bits) | (value << (32 - bits)); }

}  // namespace

Sha256::Sha256() {
    const uint32_t initial[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    memcpy(state, initial, sizeof(state));
}

void Sha256::compress(const uint8_t* block) {
    uint32_t w[64];
    for (int i = 0; i < 16; i++) {
        w[i] = static_cast<uint32_t>(block[4 * i]) << 24 | static_cast<uint32_t>(block[4 * i + 1]) << 16 |
               static_cast<uint32_t>(block[4 * i + 2]) << 8 | block[4 * i + 3];
    }
    for (int i = 16; i < 64; i++) {
        uint32_t s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ (w[i - 15] >> 3);
        uint32_t s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
    uint32_t e = state[4], f = state[5], g = state[6], h = state[7];
    for (int i = 0; i < 64; i++) {
        uint32_t s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        uint32_t choice = (e & f) ^ (~e & g);
        uint32_t t1 = h + s1 + choice + roundConstants[i] + w[i];
        uint32_t s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        uint32_t t2 = s0 + majority;
        h = g;
        g = f;
        f = e;
        e = d + t1;
        d = c;
        c = b;
        b = a;
        a = t1 + t2;
    }
    state[0] += a;
    state[1] += b;
    state[2] += c;
    state[3] += d;
    state[4] += e;
    state[5] += f;
    state[6] += g;
    state[7] += h;
}

void Sha256::update(const void* data, size_t length) {
    const uint8_t* bytes = static_cast<const uint8_t*>(data);
    total += length;
    while (length > 0) {
        size_t take = blockSize - used;
        if (take > length) take = length;
        memcpy(buffer + used, bytes, take);
        used += take;
        bytes += take;
        length -= take;
        if (used == blockSize) {
            compress(buffer);
            used = 0;
        }
    }
}

void Sha256::finish(uint8_t digest[digestSize]) {
    uint64_t bits = total * 8;
    uint8_t padding = 0x80;
    update(&padding, 1);
    padding = 0;
    while (used != blockSize - 8) update(&padding, 1);
    uint8_t length[8];
    for (int i = 0; i < 8; i++) length[i] = static_cast<uint8_t>(bits >> (56 - 8 * i));
    update(length, 8);
    for (int i = 0; i < 8; i++) {
        digest[4 * i] = static_cast<uint8_t>(state[i] >> 24);
        digest[4 * i + 1] = static_cast<uint8_t>(state[i] >> 16);
        digest[4 * i + 2] = static_cast<uint8_t>(state[i] >> 8);
        digest[4 * i + 3] = static_cast<uint8_t>(state[i]);
    }
}

void hmacSha256(const uint8_t* key, size_t keyLength, const void* data, size_t length, uint8_t mac[Sha256::digestSize]) {
    uint8_t block[Sha256::blockSize] = {};
    if (keyLength > Sha256::blockSize) {
        Sha256 hash;
        hash.update(key, keyLength);
        hash.finish(block);
    } else {
        memcpy(block, key, keyLength);
    }
    uint8_t pad[Sha256::blockSize];
    for (size_t i = 0; i < Sha256::blockSize; i++) pad[i] = block[i] ^ 0x36;
    Sha256 inner;
    inner.update(pad, sizeof(pad));
    inner.update(data, length);
    uint8_t innerDigest[Sha256::digestSize];
    inner.finish(innerDigest);

    for (size_t i = 0; i < Sha256::blockSize; i++) pad[i] = block[i] ^ 0x5c;
    Sha256 outer;
    outer.update(pad, sizeof(pad));
    outer.update(innerDigest, sizeof(innerDigest));
    outer.finish(mac);
}

}  // namespace gctally
