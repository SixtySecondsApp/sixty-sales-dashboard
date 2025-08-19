@echo off
REM Universal Environment Variables Manager - Batch Wrapper
REM Copy this file and env-manager-universal.ps1 to any project

powershell.exe -ExecutionPolicy Bypass -File "%~dp0env-manager-universal.ps1" %*