/*
 * runner.cpp — job loading + tick loop for the smatrix runner.
 *
 * The exe is deliberately dumb about physics semantics: jobs arrive as
 * the binary blob defined in node3.h (produced by script/smatrix_pack.mjs),
 * the runner ticks and dumps raw state. Classification lives in JS.
 */
#include "node3.h"
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <vector>
#include <string>
#include <chrono>
#include <filesystem>
#include <fstream>

extern "C" {
    int  smx_init(int w, int h, int d, int batch, int diss, int limit);
    int  smx_set_force(const uint32_t *idx, const uint8_t *spin,
                       const uint8_t *tens, const uint8_t *quant,
                       const uint8_t *mod, int n);
    int  smx_set_drain(int margin);
    int  smx_load(int batchIdx, const uint8_t *p3st);
    void smx_tick(void);
    int  smx_dump(int batchIdx, uint8_t *p3st);
    int  smx_counters(uint64_t *ev, uint64_t *q, uint64_t *absorbed);
    uint32_t smx_tick_id(void);
    void smx_free(void);
}

namespace fs = std::filesystem;

struct Scenario { uint8_t axis, pad; int16_t impactMilli; float phase; char name[32]; };
struct Job {
    uint32_t batch = 0, w = 0, h = 0, d = 0, ticks = 0, dumpEvery = 0;
    uint32_t absorbMargin = 0;
    int32_t diss = 15, limit = 50000;
    std::vector<Scenario> scenarios;
    std::vector<uint32_t> fIdx;
    std::vector<uint8_t> fSpin, fTens, fQuant, fMod;
    std::vector<uint8_t> states;       // batch × n*6 bytes
    size_t n() const { return (size_t)w * h * d; }
    size_t blobBytes() const { return n() * 6; }
};

template <class T>
static bool rd(std::ifstream &f, T &v) { return !!f.read((char *)&v, sizeof(v)); }

static bool loadJob(const char *path, Job &j) {
    std::ifstream f(path, std::ios::binary);
    if (!f) { fprintf(stderr, "job not found: %s\n", path); return false; }
    uint32_t magic, ver, nForce, reserved;
    rd(f, magic); rd(f, ver); rd(f, j.batch); rd(f, j.w); rd(f, j.h); rd(f, j.d);
    rd(f, j.ticks); rd(f, j.dumpEvery); rd(f, nForce); rd(f, j.absorbMargin);
    // v1.1 header tail: diss/limit appended after the margin field.
    rd(f, j.diss); rd(f, j.limit);
    (void)reserved;
    if (magic != SMX_MAGIC || ver != SMX_VERSION) {
        fprintf(stderr, "bad job magic/version: %08x v%u\n", magic, ver);
        return false;
    }
    j.scenarios.resize(j.batch);
    f.read((char *)j.scenarios.data(), j.batch * sizeof(Scenario));
    j.fIdx.resize(nForce); j.fSpin.resize(nForce);
    j.fTens.resize(nForce); j.fQuant.resize(nForce); j.fMod.resize(nForce);
    for (uint32_t i = 0; i < nForce; i++)
        rd(f, j.fIdx[i]), rd(f, j.fSpin[i]), rd(f, j.fTens[i]), rd(f, j.fQuant[i]), rd(f, j.fMod[i]);
    j.states.resize(j.batch * j.blobBytes());
    f.read((char *)j.states.data(), j.states.size());
    if (!f) { fprintf(stderr, "job truncated: expected %zu state bytes\n", j.states.size()); return false; }
    return true;
}

// Write tmp + rename so /status GETs never serve a torn heartbeat.
static void writeStatus(const fs::path &dir, const char *phase, uint32_t t,
                        uint64_t sprayEv, uint64_t sprayQ, uint64_t absorbed) {
    fs::path tmp = dir / "status.tmp", dst = dir / "status.json";
    {
        std::ofstream o(tmp);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        o << "{\n  \"ts\": " << ms << ",\n  \"runner\": \"smatrix\",\n  \"phase\": \"" << phase << "\",\n"
          << "  \"t\": " << t << ",\n  \"sprayEvents\": " << sprayEv << ",\n  \"sprayQuanta\": " << sprayQ
          << ",\n  \"absorbed\": " << absorbed << "\n}\n";
    }
    std::error_code ec;
    fs::rename(tmp, dst, ec);
    if (ec) { fs::remove(dst, ec); ec.clear(); fs::rename(tmp, dst, ec); }
}

static bool dumpBatch(const Job &j, const fs::path &dir, int b, uint32_t t) {
    std::vector<uint8_t> blob(j.blobBytes());
    smx_dump(b, blob.data());
    char name[64];
    snprintf(name, sizeof(name), "batch_%02d_t%05u.smxst", b, t);
    std::ofstream o(dir / name, std::ios::binary);
    o.write((char *)blob.data(), blob.size());
    return !!o;
}

// Runs one job to completion; heartbeat at each dump boundary and every
// ~100 ticks so the HTTP layer can serve live status.
int runJob(const char *jobPath, const char *outDir) {
    Job j;
    if (!loadJob(jobPath, j)) return 1;
    fs::create_directories(outDir);
    fprintf(stderr, "smatrix: %ux%ux%u x%u batches, %u ticks, %zu force pts, margin=%u, diss=%d limit=%d\n",
            j.w, j.h, j.d, j.batch, j.ticks, j.fIdx.size(), j.absorbMargin, j.diss, j.limit);

    if (smx_init(j.w, j.h, j.d, j.batch, j.diss, j.limit) != 0) {
        fprintf(stderr, "smx_init failed (VRAM?)\n");
        writeStatus(outDir, "error", 0, 0, 0, 0);
        return 1;
    }
    if (j.absorbMargin) smx_set_drain((int)j.absorbMargin);
    if (!j.fIdx.empty())
        smx_set_force(j.fIdx.data(), j.fSpin.data(), j.fTens.data(), j.fQuant.data(),
                      j.fMod.data(), (int)j.fIdx.size());
    for (uint32_t b = 0; b < j.batch; b++)
        if (smx_load(b, j.states.data() + b * j.blobBytes()) != 0) {
            fprintf(stderr, "smx_load failed batch %u\n", b);
            writeStatus(outDir, "error", 0, 0, 0, 0);
            smx_free();              // don't strand the VRAM for queued jobs
            return 1;
        }
    writeStatus(outDir, "ticking", 0, 0, 0, 0);
    auto t0 = std::chrono::steady_clock::now();
    for (uint32_t t = 1; t <= j.ticks; t++) {
        smx_tick();
        if (j.dumpEvery && t % j.dumpEvery == 0)
            for (uint32_t b = 0; b < j.batch; b++) dumpBatch(j, outDir, b, t);
        if (t % 100 == 0) {
            uint64_t ev, q, ab; smx_counters(&ev, &q, &ab);
            writeStatus(outDir, "ticking", t, ev, q, ab);
            auto el = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::steady_clock::now() - t0).count();
            fprintf(stderr, "  t%u (%llds)\n", t, (long long)el);
        }
    }
    for (uint32_t b = 0; b < j.batch; b++) dumpBatch(j, outDir, b, j.ticks);
    uint64_t ev, q, ab; smx_counters(&ev, &q, &ab);
    writeStatus(outDir, "done", j.ticks, ev, q, ab);
    fprintf(stderr, "smatrix: done - spray %llu events / %llu quanta, absorbed %llu\n",
            (unsigned long long)ev, (unsigned long long)q, (unsigned long long)ab);
    smx_free();
    return 0;
}
