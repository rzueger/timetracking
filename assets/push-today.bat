
@echo off
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set year=%datetime:~0,4%
set month=%datetime:~4,2%
set day=%datetime:~6,2%

set formattedDate=%year%-%month%-%day%

node "%~dp0push.js" "%formattedDate%"
