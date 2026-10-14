@echo off
rem start.bat — launch the smatrix job listener on the GPU box.
rem Drop smatrix.exe + this file anywhere, double-click, done.
rem Default port 9898, job payloads + results land under .\jobs\
rem
rem One-time validation instead (before serving real jobs):
rem   smatrix.exe run smx-validate.smx --out=runs\validate
rem   -> dumped t400 state must show 27971 live / 1678260 mass

cd /d "%~dp0"
smatrix.exe serve --port=9898 --jobs=jobs
pause
