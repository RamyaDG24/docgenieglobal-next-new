@echo off
rem Runs the built Lambda locally with the CloudFront Function in front: http://localhost:3000/
rem Build first with build-lambda.cmd. Close this window (or Ctrl+C) to stop.  (results\run-local.txt)
cd /d "%~dp0.."
node aws\run-local.mjs
pause
