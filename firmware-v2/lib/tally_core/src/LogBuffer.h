#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

enum class Severity : uint8_t { info = 0, warning = 1, error = 2 };

const char* severityName(Severity severity);

// Logs kept in RAM until the Hub can receive them, as in
// tally/src/my-log-buffer.lua: when full, a new log pushes out the oldest log
// of the lowest severity that is not above its own; otherwise it is dropped.
class LogBuffer {
public:
    static const size_t capacity = 10;
    static const size_t maxMessageLength = 80;

    void add(Severity severity, const char* message);
    bool hasLog() const { return count > 0; }
    size_t size() const { return count; }
    // Removes the oldest log; false when empty.
    bool take(Severity& severity, char* message, size_t size);

private:
    void removeAt(size_t index);

    struct Record {
        Severity severity;
        char message[maxMessageLength + 1];
    };
    Record records[capacity];
    size_t count = 0;
};

}  // namespace gctally
