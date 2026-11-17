@echo off
rem Compares the local run with the live site (read-only on live).
rem Start run-local.cmd first and leave it open.  (results\compare-local.txt)
cd /d "%~dp0.."
node aws\compare.mjs
echo.
pause
