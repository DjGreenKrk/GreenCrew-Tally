#include "LogBuffer.h"

#include <string.h>

namespace gctally {

const char* severityName(Severity severity) {
    switch (severity) {
        case Severity::error: return "ERROR";
        case Severity::warning: return "WARN";
        default: return "INFO";
    }
}

void LogBuffer::add(Severity severity, const char* message) {
    if (count >= capacity) {
        bool found = false;
        size_t indexToRemove = 0;
        for (size_t i = 0; i < count; i++) {
            Severity other = records[i].severity;
            if (other <= severity && (!found || other < records[indexToRemove].severity)) {
                indexToRemove = i;
                found = true;
            }
        }
        if (!found) return;
        removeAt(indexToRemove);
    }
    Record& record = records[count++];
    record.severity = severity;
    strncpy(record.message, message, maxMessageLength);
    record.message[maxMessageLength] = '\0';
}

bool LogBuffer::take(Severity& severity, char* message, size_t size) {
    if (count == 0) return false;
    severity = records[0].severity;
    strncpy(message, records[0].message, size - 1);
    message[size - 1] = '\0';
    removeAt(0);
    return true;
}

void LogBuffer::removeAt(size_t index) {
    for (size_t i = index; i + 1 < count; i++) records[i] = records[i + 1];
    count--;
}

}  // namespace gctally
