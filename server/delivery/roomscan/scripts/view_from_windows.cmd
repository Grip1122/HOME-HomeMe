@echo off
title RoomScan - SSH tunnel
echo Connecting to xch@10.200.238.100 ...
echo After SSH authentication, open http://localhost:8765 in your browser.
echo Keep this window open. Press Ctrl+C to close the tunnel.
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 8765:127.0.0.1:8765 xch@10.200.238.100
if errorlevel 1 pause
