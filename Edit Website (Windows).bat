@echo off
REM Double-click this file to open the website editor (Windows).
cd /d "%~dp0"
title Website editor
where py >nul 2>nul && (py -3 "_editor\server.py" & goto done)
where python >nul 2>nul && (python "_editor\server.py" & goto done)
echo Python 3 is not installed.
echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH", then try again.
:done
echo.
pause
