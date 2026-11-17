@echo off
rem Compares an AWS address (e.g. https://dxxxx.cloudfront.net) with the live site (read-only on live).
rem  (results\compare-<name>.txt)
cd /d "%~dp0.."
set /p TARGET=Paste the AWS address (e.g. https://d1234abcd.cloudfront.net): 
node aws\compare.mjs --target %TARGET%
echo.
pause
