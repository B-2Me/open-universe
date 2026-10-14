@echo off
rem build.bat — smatrix CUDA runner. Run from a "x64 Native Tools" prompt
rem or after vcvars64.bat. Requires CUDA Toolkit 12.x on PATH.
rem
rem   -arch=sm_86        RTX 3060
rem   -cudart=static     self-contained exe — GPU box needs only the driver
rem   -O3                host opt; device math is all-integer anyway
nvcc -O3 -std=c++17 -arch=sm_86 -cudart=static ^
     -o smatrix.exe ^
     kernel.cu runner.cpp http.cpp main.cpp ^
     -lws2_32
if errorlevel 1 (echo BUILD FAILED & exit /b 1)
echo built smatrix.exe — ship with seed JSONs to the GPU box
