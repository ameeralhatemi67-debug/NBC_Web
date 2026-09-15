@echo off
cd /d "%~dp0"
title NBC Live Share
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\share.ps1"
