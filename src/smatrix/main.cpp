/*
 * main.cpp — smatrix runner entry point.
 *
 *   smatrix run  <jobfile.smx> [--out=<dir>]   local single-job mode
 *   smatrix serve --port=9898 [--jobs=<dir>]   LAN listener mode
 *
 * serve mode: POST job binaries, GET status/result/state — the whole
 * remote-runtime contract in one exe. No deps beyond winsock + cudart.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

int runJob(const char *jobPath, const char *outDir);
int httpServe(uint16_t port, const char *jobsDir, const char *bindAddr);

static const char *flag(int argc, char **argv, const char *k, const char *def) {
    for (int i = 2; i < argc; i++) {
        if (strncmp(argv[i], k, strlen(k)) == 0 && argv[i][strlen(k)] == '=')
            return argv[i] + strlen(k) + 1;
    }
    return def;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: smatrix run <job.smx> [--out=dir] | serve [--port=N] [--jobs=dir]\n");
        return 1;
    }
    if (strcmp(argv[1], "run") == 0) {
        if (argc < 3) { fprintf(stderr, "run needs a jobfile\n"); return 1; }
        return runJob(argv[2], flag(argc, argv, "--out", "out"));
    }
    if (strcmp(argv[1], "serve") == 0) {
        return httpServe((uint16_t)atoi(flag(argc, argv, "--port", "9898")),
                         flag(argc, argv, "--jobs", "jobs"),
                         flag(argc, argv, "--bind", nullptr));
    }
    fprintf(stderr, "unknown mode: %s\n", argv[1]);
    return 1;
}
