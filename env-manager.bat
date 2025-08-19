@echo off
REM Environment Variables Manager - Batch Wrapper
REM This makes it easier to run the PowerShell script

powershell.exe -ExecutionPolicy Bypass -File "%~dp0env-manager.ps1" %*
