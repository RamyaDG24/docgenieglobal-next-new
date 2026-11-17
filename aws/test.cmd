@echo off
rem Runs the site tests (Jest) and the AWS tests.  (results\tests.txt)
cd /d "%~dp0.."
node aws\test.mjs
echo.
pause
