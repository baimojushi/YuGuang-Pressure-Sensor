#pragma once
#include <stdint.h>
#include <string.h>

// LD6002 TF parser ported from the supplied Radar_Filter_v8/src/main.cpp.
// Byte format: SOF, ID(2), LEN(2), TYPE(2), ~XOR(header), PAYLOAD, ~XOR(data).
// Header numeric fields use network byte order; payload float fields are LE.
namespace ld6002_tf {
static const uint8_t SOF = 0x01;
static const uint16_t TYPE_HUMAN = 0x0F09;
static const uint16_t TYPE_PHASE = 0x0A13;
static const uint16_t TYPE_BREATH = 0x0A14;
static const uint16_t TYPE_HEART = 0x0A15;
static const uint16_t TYPE_DISTANCE = 0x0A16;
static const uint16_t MAX_PAYLOAD = 64;

struct Frame {
    uint16_t id;
    uint16_t type;
    uint16_t length;
    uint8_t payload[MAX_PAYLOAD];
};

class Parser {
public:
    Parser() : state_(FIND_SOF), header_xor_(0), data_xor_(0),
        frame_id_(0), length_(0), type_(0), pos_(0), last_byte_ms_(0),
        errors_(0), good_frames_(0) { memset(payload_, 0, sizeof(payload_)); }
    uint32_t errors() const { return errors_; }
    uint32_t good_frames() const { return good_frames_; }

    bool feed(uint8_t b, uint32_t now_ms, Frame* completed) {
        // Preserve the original 200 ms malformed-frame timeout behavior.
        if (state_ != FIND_SOF && (uint32_t)(now_ms - last_byte_ms_) > 200U)
            reset();
        last_byte_ms_ = now_ms;
        switch (state_) {
        case FIND_SOF:
            if (b == SOF) { header_xor_ = b; state_ = ID_HIGH; }
            break;
        case ID_HIGH:
            header_xor_ ^= b;
            frame_id_ = (uint16_t)b << 8;
            state_ = ID_LOW;
            break;
        case ID_LOW:
            header_xor_ ^= b;
            frame_id_ |= b;
            state_ = LEN_HIGH;
            break;
        case LEN_HIGH:
            header_xor_ ^= b;
            length_ = (uint16_t)b << 8;
            state_ = LEN_LOW;
            break;
        case LEN_LOW:
            header_xor_ ^= b;
            length_ |= b;
            if (length_ > MAX_PAYLOAD) { ++errors_; reset(); }
            else state_ = TYPE_HIGH;
            break;
        case TYPE_HIGH:
            header_xor_ ^= b;
            type_ = (uint16_t)b << 8;
            state_ = TYPE_LOW;
            break;
        case TYPE_LOW:
            header_xor_ ^= b;
            type_ |= b;
            state_ = HEADER_XOR;
            break;
        case HEADER_XOR:
            if (b != (uint8_t)(~header_xor_)) { ++errors_; reset(); }
            else { pos_ = 0; data_xor_ = 0; state_ = length_ ? PAYLOAD : DATA_XOR; }
            break;
        case PAYLOAD:
            payload_[pos_++] = b;
            data_xor_ ^= b;
            if (pos_ == length_) state_ = DATA_XOR;
            break;
        case DATA_XOR: {
            const bool valid = b == (uint8_t)(~data_xor_);
            if (!valid) ++errors_;
            else {
                ++good_frames_;
                if (completed) {
                    completed->id = frame_id_;
                    completed->type = type_;
                    completed->length = length_;
                    memcpy(completed->payload, payload_, length_);
                }
            }
            reset();
            return valid;
        }
        }
        return false;
    }
private:
    enum State : uint8_t {
        FIND_SOF, ID_HIGH, ID_LOW, LEN_HIGH, LEN_LOW,
        TYPE_HIGH, TYPE_LOW, HEADER_XOR, PAYLOAD, DATA_XOR
    };
    void reset() { state_ = FIND_SOF; header_xor_ = data_xor_ = 0; pos_ = 0; }
    State state_;
    uint8_t header_xor_, data_xor_;
    uint16_t frame_id_, length_, type_, pos_;
    uint8_t payload_[MAX_PAYLOAD];
    uint32_t last_byte_ms_, errors_, good_frames_;
};
} // namespace ld6002_tf
