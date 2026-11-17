@echo off
rem Builds the Lambda zip: aws\dist\docgenieglobal-website.zip  (results\build-lambda.txt)
cd /d "%~dp0.."
if not exist node_modules\next (
  echo node_modules is missing - running npm ci first ...
  call npm ci || goto :end
)
node aws\build-lambda.mjs
:end
echo.
pause
