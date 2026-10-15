/*
 * http.cpp — minimal Winsock HTTP/1.1 listener for the smatrix runner.
 *
 * Deliberately tiny — three routes, no framework:
 *   POST /job           body = SMX1 binary → queued, returns {"id":N}
 *   GET  /status        latest job status.json (heartbeat schema)
 *   GET  /result/<id>   job dir listing + status + counters
 *   GET  /state/<id>/<b>  raw batch-state blob (6B/node planes)
 *
 * POST bodies stream straight to disk — a 32-batch 256³ job is ~3.2GB,
 * so nothing is buffered in memory.
 */
#include <winsock2.h>
#include <ws2tcpip.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <queue>
#include <atomic>
#include <condition_variable>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <exception>
#include <eh.h>

#pragma comment(lib, "ws2_32.lib")

int runJob(const char *jobPath, const char *outDir);   // runner.cpp

namespace fs = std::filesystem;

// ---------------- job queue ----------------
struct QJob { int id; fs::path file; };
static std::queue<QJob> g_queue;
static std::mutex g_mu;
static std::condition_variable g_cv;
static int g_nextId = 1;
static int g_runningId = -1;
static fs::path g_jobsDir;
static std::atomic<bool> g_stop{false};

static void workerMain() {
    for (;;) {
        QJob j;
        try {
            {
                std::unique_lock<std::mutex> lk(g_mu);
                g_cv.wait(lk, [] { return g_stop || !g_queue.empty(); });
                if (g_stop) return;
                j = g_queue.front(); g_queue.pop();
                g_runningId = j.id;
            }
            fs::path dir = g_jobsDir / ("job_" + std::to_string(j.id));
            fprintf(stderr, "worker: starting job %d\n", j.id);
            runJob(j.file.string().c_str(), dir.string().c_str());
            fprintf(stderr, "worker: job %d finished\n", j.id);
            std::lock_guard<std::mutex> lk(g_mu);
            g_runningId = -1;
        } catch (const std::exception &e) {
            fprintf(stderr, "worker: exception: %s\n", e.what());
            std::lock_guard<std::mutex> lk(g_mu);
            g_runningId = -1;
        } catch (...) {
            fprintf(stderr, "worker: unknown exception\n");
            std::lock_guard<std::mutex> lk(g_mu);
            g_runningId = -1;
        }
    }
}

// ---------------- HTTP helpers ----------------
static void sendAll(SOCKET s, const char *p, size_t n) {
    while (n) { int k = send(s, p, (int)n, 0); if (k <= 0) return; p += k; n -= k; }
}
static void reply(SOCKET s, int code, const char *ctype, const std::string &body) {
    const char *txt = code == 200 ? "OK" : code == 404 ? "Not Found" : "Bad Request";
    std::ostringstream h;
    h << "HTTP/1.1 " << code << " " << txt << "\r\nContent-Type: " << ctype
      << "\r\nContent-Length: " << body.size() << "\r\nConnection: close\r\n\r\n";
    std::string hdr = h.str();
    sendAll(s, hdr.data(), hdr.size());
    sendAll(s, body.data(), body.size());
}
// Streamed — state blobs run 100MB+; never buffer the whole body.
static bool sendFile(SOCKET s, const fs::path &p, const char *ctype) {
    std::error_code ec;
    auto sz = fs::file_size(p, ec);
    if (ec) return false;
    std::ifstream f(p, std::ios::binary);
    if (!f) return false;
    std::ostringstream h;
    h << "HTTP/1.1 200 OK\r\nContent-Type: " << ctype
      << "\r\nContent-Length: " << sz << "\r\nConnection: close\r\n\r\n";
    std::string hdr = h.str();
    sendAll(s, hdr.data(), hdr.size());
    char buf[1 << 16];
    while (f) { f.read(buf, sizeof(buf)); auto n = f.gcount(); if (n > 0) sendAll(s, buf, (size_t)n); }
    return true;
}

// Read until end of headers; returns parsed request line + content length.
// Any leftover header-buffer bytes are kept in `rest` for the body.
static bool readHeaders(SOCKET s, std::string &method, std::string &path,
                        long long &contentLen, std::string &rest) {
    std::string buf;
    char tmp[8192];
    for (;;) {
        size_t e = buf.find("\r\n\r\n");
        if (e != std::string::npos) {
            rest = buf.substr(e + 4);
            buf = buf.substr(0, e);
            break;
        }
        int n = recv(s, tmp, sizeof(tmp), 0);
        if (n <= 0) return false;
        buf.append(tmp, n);
        if (buf.size() > 65536) return false;
    }
    std::istringstream hs(buf);
    std::string ver;
    hs >> method >> path >> ver;
    contentLen = 0;
    std::string line;
    while (std::getline(hs, line)) {
        if (line.size() > 16 && _strnicmp(line.c_str(), "content-length:", 15) == 0)
            contentLen = strtoll(line.c_str() + 15, nullptr, 10);
    }
    return true;
}

static void handleRequest(SOCKET s, std::string &method, std::string &path,
                          std::string &rest, long long clen);

static void handleConn(SOCKET s);

// SEH wrapper — no C++-object locals allowed in a __try function, so it
// wraps handleConn. GetExceptionCode() tells us whether we're looking at
// an AV (0xC0000005), a stack overflow (0xC00000FD), a misaligned/stack-
// cookie fault, or a C++ exception escaping where it shouldn't
// (0xE06D7363) — catch(...) under /EHa hides which.
static void handleConnSeh(SOCKET s) {
    __try {
        handleConn(s);
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        fprintf(stderr, "conn SEH 0x%08lx\n", GetExceptionCode());
        closesocket(s);
    }
}

static void sehXlat(unsigned code, EXCEPTION_POINTERS *) {
    char m[64]; snprintf(m, sizeof(m), "structured exception 0x%08x", code);
    throw std::runtime_error(m);
}

static void handleConn(SOCKET s) {
    _set_se_translator(sehXlat);   // translator registration is per-thread
    std::string method, path, rest;
    long long clen = 0;
    try {
        if (!readHeaders(s, method, path, clen, rest)) { closesocket(s); return; }
        fprintf(stderr, ">> %s %s (clen=%lld)\n", method.c_str(), path.c_str(), clen);
        handleRequest(s, method, path, rest, clen);
        fprintf(stderr, "<< done %s\n", path.c_str());
    } catch (const std::exception &e) {
        fprintf(stderr, "conn exception: %s\n", e.what());
        try { closesocket(s); } catch (...) {}
    } catch (...) {
        fprintf(stderr, "conn exception: unknown\n");
        try { closesocket(s); } catch (...) {}
    }
}

static void handleRequest(SOCKET s, std::string &method, std::string &path,
                          std::string &rest, long long clen) {

    if (method == "POST" && (path == "/job" || path.rfind("/job?", 0) == 0)) {
        int id;
        {
            std::lock_guard<std::mutex> lk(g_mu);
            id = g_nextId++;
        }
        fs::create_directories(g_jobsDir);
        fs::path fp = g_jobsDir / ("job_" + std::to_string(id) + ".smx");
        std::ofstream o(fp, std::ios::binary);
        long long got = 0;
        if (!rest.empty()) { o.write(rest.data(), rest.size()); got += (long long)rest.size(); }
        // Heap, not stack — a 1MB array in this frame overflows a
        // detached thread's default stack at function entry (stack probe
        // trips the guard page: 0xC00000FD before the first statement).
        std::vector<char> tmp(1 << 20);
        while (got < clen) {
            int want = (int)std::min<long long>((long long)tmp.size(), clen - got);
            int n = recv(s, tmp.data(), want, 0);
            if (n <= 0) break;
            o.write(tmp.data(), n); got += n;
        }
        o.close();
        if (got != clen) { reply(s, 400, "application/json", "{\"error\":\"truncated body\"}"); closesocket(s); return; }
        { std::lock_guard<std::mutex> lk(g_mu); g_queue.push({id, fp}); }
        g_cv.notify_one();
        reply(s, 200, "application/json", "{\"id\":" + std::to_string(id) + ",\"queued\":true}");
    } else if (method == "GET" && path == "/status") {
        fs::path st;
        {
            std::lock_guard<std::mutex> lk(g_mu);
            if (g_runningId >= 0) st = g_jobsDir / ("job_" + std::to_string(g_runningId)) / "status.json";
        }
        if (st.empty() || !sendFile(s, st, "application/json"))
            reply(s, 200, "application/json", "{\"phase\":\"idle\"}");
    } else if (method == "GET" && path.rfind("/result/", 0) == 0) {
        int id = atoi(path.c_str() + 8);
        fs::path dir = g_jobsDir / ("job_" + std::to_string(id));
        if (!fs::exists(dir)) { reply(s, 404, "application/json", "{}"); }
        else {
            std::ostringstream o;
            o << "{\"id\":" << id << ",\"files\":[";
            bool first = true;
            for (auto &e : fs::directory_iterator(dir)) {
                if (!first) o << ",";
                o << "\"" << e.path().filename().string() << "\"";
                first = false;
            }
            o << "]}";
            reply(s, 200, "application/json", o.str());
        }
    } else if (method == "GET" && path.rfind("/file/", 0) == 0) {
        // /file/<id>/<name> — arbitrary artifact from a job dir, with a
        // strict filename whitelist (no traversal).
        int id = 0; char fname[64] = {};
        if (sscanf(path.c_str(), "/file/%d/%63s", &id, fname) == 2) {
            std::string fn(fname);
            if (fn.find("..") == std::string::npos && fn.find('/') == std::string::npos
                && fn.find('\\') == std::string::npos) {
                fs::path fp = g_jobsDir / ("job_" + std::to_string(id)) / fn;
                if (!sendFile(s, fp, "application/octet-stream"))
                    reply(s, 404, "application/json", "{}");
            } else reply(s, 400, "application/json", "{}");
        } else reply(s, 400, "application/json", "{}");
    } else if (method == "GET" && path.rfind("/state/", 0) == 0) {
        // /state/<id>/<batch> → latest dump for that batch
        int id = 0; unsigned b = 0;
        if (sscanf(path.c_str(), "/state/%d/%u", &id, &b) == 2) {
            fs::path dir = g_jobsDir / ("job_" + std::to_string(id));
            std::error_code ec;
            if (!fs::exists(dir, ec)) { reply(s, 404, "application/json", "{}"); closesocket(s); return; }
            fs::path best; uint32_t bt = 0;
            char prefix[32]; snprintf(prefix, sizeof(prefix), "batch_%02d_t", b);
            for (auto &e : fs::directory_iterator(dir, ec)) {
                std::string fn = e.path().filename().string();
                if (fn.rfind(prefix, 0) == 0) {
                    uint32_t t = (uint32_t)atoi(fn.c_str() + strlen(prefix));
                    if (t >= bt) { bt = t; best = e.path(); }
                }
            }
            if (!best.empty()) sendFile(s, best, "application/octet-stream");
            else reply(s, 404, "application/json", "{}");
        } else reply(s, 400, "application/json", "{}");
    } else if (method == "GET" && (path == "/" || path == "/health")) {
        std::lock_guard<std::mutex> lk(g_mu);
        reply(s, 200, "application/json",
              "{\"smatrix\":\"ok\",\"queued\":" + std::to_string(g_queue.size()) +
              ",\"running\":" + std::to_string(g_runningId) + "}");
    } else {
        reply(s, 404, "application/json", "{}");
    }
    closesocket(s);
}

int httpServe(uint16_t port, const char *jobsDir, const char *bindAddr) {
    // A silent abort in a detached thread looks like "the exe bails out".
    // Name every death before it happens.
    std::set_terminate([] {
        fprintf(stderr, "FATAL: std::terminate (uncaught exception in a thread)\n");
        fflush(stderr);
        abort();
    });
    // Turn access violations / structured exceptions into C++ exceptions
    // so the per-conn handlers above can log them instead of dying blind.
    _set_se_translator([](unsigned code, EXCEPTION_POINTERS *) {
        char m[64]; snprintf(m, sizeof(m), "structured exception 0x%08x", code);
        throw std::runtime_error(m);
    });
    g_jobsDir = jobsDir;
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) { fprintf(stderr, "WSAStartup failed\n"); return 1; }
    SOCKET ls = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    int on = 1; setsockopt(ls, SOL_SOCKET, SO_REUSEADDR, (char *)&on, sizeof(on));
    sockaddr_in a{};
    a.sin_family = AF_INET;
    a.sin_port = htons(port);
    if (bindAddr && bindAddr[0]) {
        if (inet_pton(AF_INET, bindAddr, &a.sin_addr) != 1) {
            fprintf(stderr, "invalid --bind address: %s\n", bindAddr); return 1;
        }
    } else {
        a.sin_addr.s_addr = INADDR_ANY;   // all interfaces
    }
    if (bind(ls, (sockaddr *)&a, sizeof(a)) != 0 || listen(ls, 16) != 0) {
        fprintf(stderr, "bind/listen failed on port %u\n", port); return 1;
    }
    char bound[64]; inet_ntop(AF_INET, &a.sin_addr, bound, sizeof(bound));
    fprintf(stderr, "smatrixd listening on %s:%u - jobs dir %s\n", bound, port, jobsDir);
    std::thread(workerMain).detach();
    fprintf(stderr, "smatrixd ready\n");
    for (;;) {
        SOCKET c = accept(ls, nullptr, nullptr);
        if (c == INVALID_SOCKET) {
            fprintf(stderr, "accept failed: wsa=%d\n", WSAGetLastError());
            Sleep(50);
            continue;
        }
        fprintf(stderr, "accept: socket %llu\n", (unsigned long long)c);
        try {
            std::thread(handleConnSeh, c).detach();
        } catch (const std::exception &e) {
            fprintf(stderr, "thread spawn failed: %s\n", e.what());
            closesocket(c);
        }
    }
    return 0;
}
