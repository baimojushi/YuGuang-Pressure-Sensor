#include "radar_resp_filter_v8.h"
#include "radar_tf_parser.hpp"
#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstdio>

static void test_parser() {
    ld6002_tf::Parser parser;
    ld6002_tf::Frame out={};
    // One well-formed 'human present' frame: SOF, id, len, type, inverted XOR, payload, inverted XOR.
    uint8_t frame[]={1, 0,1, 0,2, 0x0f,0x09,0, 1,0,0};
    uint8_t x=0;
    for(int i=0;i<7;i++)x^=frame[i];
    frame[7]=(uint8_t)(~x);
    frame[10]=(uint8_t)(~(frame[8]^frame[9]));
    bool complete=false;
    for(unsigned i=0;i<sizeof(frame);++i)complete=parser.feed(frame[i],i*5,&out)||complete;
    assert(complete&&out.type==ld6002_tf::TYPE_HUMAN&&out.length==2&&out.payload[0]==1);
    frame[10]^=0x01;complete=false;
    for(unsigned i=0;i<sizeof(frame);++i)complete=parser.feed(frame[i],1000+i*5,&out)||complete;
    assert(!complete && parser.errors()>0);
}
static void test_filter() {
    radar_v8::Filter f;
    f.on_human(false);
    for(int i=1;i<=1300;++i)f.add(std::sin(float(i)*0.03f),uint32_t(i*20));
    assert(f.result().human==0); // no person => never a valid breathing claim
    f.on_human(true);
    for(int i=1;i<=1400;++i) {
        float wave=0.25f*std::sin(6.2831853f*0.25f*float(i)/50.0f);
        f.add(wave,uint32_t(30000+i*20));
    }
    const radar_v8::Result r=f.result();
    assert(r.human==1);
    assert(std::isfinite(r.br)&&std::isfinite(r.conf)&&std::isfinite(r.fs));
    assert(r.br>=0 && r.br<100);
}
int main(){test_parser();test_filter();std::puts("PASS: LD6002 TF parser CRC + radar v8 non-human/finite-output guards");}
