#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

// SHA-256 and HMAC-SHA256 (FIPS 180-4, RFC 2104), small enough for the
// ESP8266 and testable on a computer. Used to check management messages
// from the paired Hub (Pairing.h).
class Sha256 {
public:
    static const size_t digestSize = 32;
    static const size_t blockSize = 64;

    Sha256();
    void update(const void* data, size_t length);
    void finish(uint8_t digest[digestSize]);

private:
    void compress(const uint8_t* block);

    uint32_t state[8];
    uint8_t buffer[blockSize];
    size_t used = 0;
    uint64_t total = 0;
};

void hmacSha256(const uint8_t* key, size_t keyLength, const void* data, size_t length, uint8_t mac[Sha256::digestSize]);

}  // namespace gctally
